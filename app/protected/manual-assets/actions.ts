'use server'

import { fromDecimal } from '@finova/domain/money'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import {
  createManualAssetIncomeSchema,
  createManualAssetSchema,
  createManualAssetValuationSchema,
  manualAssetRowSchema,
  manualAssetValuationRowSchema,
  normalizeDecimal,
  updateManualAssetSchema,
} from '@/lib/validation/manual-assets'

/**
 * Server actions for the Manual Assets screen. `requireUser()` first
 * everywhere; rows are keyed by verified `claims.sub` and RLS enforces
 * ownership. Valuations always inherit the parent asset's currency — the UI
 * never sends one.
 */

const MANUAL_ASSETS_PATH = '/protected/manual-assets'

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

const UNEXPECTED = 'unexpected'

/** First message per field, for inline form errors. */
function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !(key in out)) {
      out[key] = issue.message
    }
  }
  return out
}

/** Decimal string in major units → integer cents in `currency`. */
function toCents(input: string, currency: string): number {
  return fromDecimal(normalizeDecimal(input), currency).amount
}

function revalidate() {
  revalidatePath(MANUAL_ASSETS_PATH)
  revalidatePath('/protected')
}

/** The parsed asset row, verifying visibility under RLS. */
async function getOwnAsset(assetId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('manual_assets')
    .select('*')
    .eq('id', assetId)
    .maybeSingle()
  if (error || !data) {
    return null
  }
  return manualAssetRowSchema.parse(data)
}

export async function createManualAsset(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const claims = await requireUser()
  const parsed = createManualAssetSchema.safeParse({
    acquisitionDate: formData.get('acquisitionDate'),
    costBasis: formData.get('costBasis'),
    currency: formData.get('currency'),
    currentValue: formData.get('currentValue'),
    name: formData.get('name'),
    notes: formData.get('notes') ?? undefined,
    type: formData.get('type'),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validationFailed',
      fieldErrors: toFieldErrors(parsed.error),
    }
  }
  const input = parsed.data

  try {
    const supabase = await createClient()
    const currentValueCents = toCents(input.currentValue, input.currency)
    const { data: created, error } = await supabase
      .from('manual_assets')
      .insert({
        acquisition_date: input.acquisitionDate,
        cost_basis_cents: toCents(input.costBasis, input.currency),
        currency: input.currency,
        current_value_cents: currentValueCents,
        last_valued_at: input.acquisitionDate,
        name: input.name,
        notes: input.notes ?? null,
        type: input.type,
        user_id: claims.sub,
      })
      .select('id')
      .single()
    if (error || !created) {
      return { ok: false, error: UNEXPECTED }
    }
    // Seed the valuation history so growth charts start at day one.
    await supabase.from('manual_asset_valuations').insert({
      manual_asset_id: created.id,
      source: 'manual',
      user_id: claims.sub,
      valuation_date: input.acquisitionDate,
      value_cents: currentValueCents,
    })
  } catch {
    return { ok: false, error: UNEXPECTED }
  }

  revalidate()
  return { ok: true }
}

export async function updateManualAsset(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  await requireUser()
  const parsed = updateManualAssetSchema.safeParse({
    id: formData.get('id'),
    isClosed: formData.get('isClosed') === 'on',
    name: formData.get('name'),
    notes: formData.get('notes') ?? undefined,
    type: formData.get('type'),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validationFailed',
      fieldErrors: toFieldErrors(parsed.error),
    }
  }
  const input = parsed.data

  const supabase = await createClient()
  const { error } = await supabase
    .from('manual_assets')
    .update({
      is_closed: input.isClosed,
      name: input.name,
      notes: input.notes ?? null,
      type: input.type,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }
  revalidate()
  return { ok: true }
}

export async function deleteManualAsset(id: string): Promise<ActionResult> {
  await requireUser()
  if (!z.uuid().safeParse(id).success) {
    return { ok: false, error: UNEXPECTED }
  }
  const supabase = await createClient()
  const { error } = await supabase.from('manual_assets').delete().eq('id', id)
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }
  revalidate()
  return { ok: true }
}

/**
 * Record a valuation snapshot (idempotent per asset+date) and mirror the
 * newest valuation into the asset's current value.
 */
export async function createManualAssetValuation(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const claims = await requireUser()
  const parsed = createManualAssetValuationSchema.safeParse({
    manualAssetId: formData.get('manualAssetId'),
    notes: formData.get('notes') ?? undefined,
    source: formData.get('source') || undefined,
    value: formData.get('value'),
    valuationDate: formData.get('valuationDate'),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validationFailed',
      fieldErrors: toFieldErrors(parsed.error),
    }
  }
  const input = parsed.data

  const asset = await getOwnAsset(input.manualAssetId)
  if (!asset) {
    return { ok: false, error: UNEXPECTED }
  }
  const supabase = await createClient()
  const { error } = await supabase.from('manual_asset_valuations').upsert(
    {
      manual_asset_id: input.manualAssetId,
      notes: input.notes ?? null,
      source: input.source,
      user_id: claims.sub,
      valuation_date: input.valuationDate,
      value_cents: toCents(input.value, asset.currency),
    },
    { onConflict: 'manual_asset_id,valuation_date' }
  )
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }
  const syncError = await syncCurrentValue(input.manualAssetId)
  if (syncError) {
    return { ok: false, error: UNEXPECTED }
  }
  revalidate()
  return { ok: true }
}

/** Record a point-in-time income payment (coupon, interest, distribution). */
export async function createManualAssetIncome(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const claims = await requireUser()
  const parsed = createManualAssetIncomeSchema.safeParse({
    amount: formData.get('amount'),
    manualAssetId: formData.get('manualAssetId'),
    notes: formData.get('notes') ?? undefined,
    receivedDate: formData.get('receivedDate'),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validationFailed',
      fieldErrors: toFieldErrors(parsed.error),
    }
  }
  const input = parsed.data

  const asset = await getOwnAsset(input.manualAssetId)
  if (!asset) {
    return { ok: false, error: UNEXPECTED }
  }
  const supabase = await createClient()
  const { error } = await supabase.from('manual_asset_income').insert({
    amount_cents: toCents(input.amount, asset.currency),
    manual_asset_id: input.manualAssetId,
    notes: input.notes ?? null,
    received_date: input.receivedDate,
    user_id: claims.sub,
  })
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }
  revalidate()
  return { ok: true }
}

export async function deleteManualAssetIncome(
  id: string
): Promise<ActionResult> {
  await requireUser()
  if (!z.uuid().safeParse(id).success) {
    return { ok: false, error: UNEXPECTED }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from('manual_asset_income')
    .delete()
    .eq('id', id)
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }
  revalidate()
  return { ok: true }
}

export async function deleteManualAssetValuation(
  id: string
): Promise<ActionResult> {
  await requireUser()
  if (!z.uuid().safeParse(id).success) {
    return { ok: false, error: UNEXPECTED }
  }
  const supabase = await createClient()
  const { data: target } = await supabase
    .from('manual_asset_valuations')
    .select('manual_asset_id')
    .eq('id', id)
    .maybeSingle()
  const { error } = await supabase
    .from('manual_asset_valuations')
    .delete()
    .eq('id', id)
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }
  if (target) {
    await syncCurrentValue(String(target.manual_asset_id))
  }
  revalidate()
  return { ok: true }
}

/** Point `current_value_cents`/`last_valued_at` at the latest valuation. */
async function syncCurrentValue(assetId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('manual_asset_valuations')
    .select('*')
    .eq('manual_asset_id', assetId)
    .order('valuation_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    return error.message
  }
  if (!data) {
    return null // no snapshots left; keep the asset's stored value
  }
  const latest = manualAssetValuationRowSchema.parse(data)
  const { error: updateError } = await supabase
    .from('manual_assets')
    .update({
      current_value_cents: latest.value_cents,
      last_valued_at: latest.valuation_date,
      updated_at: new Date().toISOString(),
    })
    .eq('id', assetId)
  return updateError ? updateError.message : null
}
