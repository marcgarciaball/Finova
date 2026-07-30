'use server'

import { fromDecimal } from '@finova/domain/money'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import { createDebtSchema, updateDebtSchema } from '@/lib/validation/debts'
import { normalizeDecimal } from '@/lib/validation/real-estate'

/**
 * Server actions for the Debts screen. `requireUser()` first everywhere; rows
 * are keyed by verified `claims.sub` and RLS enforces ownership.
 */

const DEBTS_PATH = '/protected/debts'

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
  revalidatePath(DEBTS_PATH)
  revalidatePath('/protected')
}

export async function createDebt(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const claims = await requireUser()
  const parsed = createDebtSchema.safeParse({
    currency: formData.get('currency'),
    interestRatePct: formData.get('interestRatePct'),
    lender: formData.get('lender'),
    notes: formData.get('notes') ?? undefined,
    outstanding: formData.get('outstanding'),
    payment: formData.get('payment'),
    principal: formData.get('principal'),
    propertyId: formData.get('propertyId') || undefined,
    rateType: formData.get('rateType'),
    startDate: formData.get('startDate'),
    termMonths: formData.get('termMonths'),
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
  const { error } = await supabase.from('debts').insert({
    currency: input.currency,
    interest_rate_pct: normalizeDecimal(input.interestRatePct),
    lender: input.lender,
    notes: input.notes ?? null,
    outstanding_cents: toCents(input.outstanding, input.currency),
    payment_cents: toCents(input.payment, input.currency),
    principal_cents: toCents(input.principal, input.currency),
    property_id: input.type === 'mortgage' ? (input.propertyId ?? null) : null,
    rate_type: input.rateType,
    start_date: input.startDate,
    status: 'active',
    term_months: input.termMonths,
    type: input.type,
    user_id: claims.sub,
  })
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }
  revalidate()
  return { ok: true }
}

export async function updateDebt(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  await requireUser()
  const parsed = updateDebtSchema.safeParse({
    id: formData.get('id'),
    interestRatePct: formData.get('interestRatePct'),
    lender: formData.get('lender'),
    notes: formData.get('notes') ?? undefined,
    outstanding: formData.get('outstanding'),
    payment: formData.get('payment'),
    status: formData.get('status'),
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
  const { data: debtRow } = await supabase
    .from('debts')
    .select('currency')
    .eq('id', input.id)
    .maybeSingle()
  if (!debtRow) {
    return { ok: false, error: UNEXPECTED }
  }
  const currency = String(debtRow.currency)
  const { error } = await supabase
    .from('debts')
    .update({
      interest_rate_pct: normalizeDecimal(input.interestRatePct),
      lender: input.lender,
      notes: input.notes ?? null,
      outstanding_cents: toCents(input.outstanding, currency),
      payment_cents: toCents(input.payment, currency),
      status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }
  revalidate()
  return { ok: true }
}

export async function deleteDebt(id: string): Promise<ActionResult> {
  await requireUser()
  if (!z.uuid().safeParse(id).success) {
    return { ok: false, error: UNEXPECTED }
  }
  const supabase = await createClient()
  const { error } = await supabase.from('debts').delete().eq('id', id)
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }
  revalidate()
  return { ok: true }
}
