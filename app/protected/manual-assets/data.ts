import 'server-only'
import {
  aggregatePortfolio,
  type CurrencyTotals,
} from '@finova/domain/manual-assets/metrics'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import {
  type ManualAssetIncomeRow,
  type ManualAssetRow,
  type ManualAssetValuationRow,
  manualAssetIncomeRowSchema,
  manualAssetRowSchema,
  manualAssetValuationRowSchema,
} from '@/lib/validation/manual-assets'

/**
 * Read layer for the Manual Assets screen. RLS-scoped user client throughout;
 * every row passes through its zod schema.
 */

export interface ManualAssetsOverview {
  assets: ManualAssetRow[]
  totals: CurrencyTotals[]
}

export interface ManualAssetDetail {
  asset: ManualAssetRow
  income: ManualAssetIncomeRow[]
  valuations: ManualAssetValuationRow[]
}

/** Every asset, plus per-currency totals. */
export async function getManualAssetsOverview(): Promise<ManualAssetsOverview> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('manual_assets')
    .select('*')
    .order('acquisition_date', { ascending: false })
  if (error) {
    throw new Error(error.message)
  }
  const assets = manualAssetRowSchema.array().parse(data ?? [])
  const totals = aggregatePortfolio(
    assets.map((a) => ({
      currency: a.currency,
      currentValueCents: a.current_value_cents,
      isClosed: a.is_closed,
    }))
  )
  return { assets, totals }
}

/** One asset with its valuation history, or null when not visible. */
export async function getManualAssetDetail(
  id: string
): Promise<ManualAssetDetail | null> {
  await requireUser()
  const supabase = await createClient()

  const { data: assetRow, error } = await supabase
    .from('manual_assets')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    throw new Error(error.message)
  }
  if (!assetRow) {
    return null
  }
  const asset = manualAssetRowSchema.parse(assetRow)

  const { data: valuationRows, error: valuationError } = await supabase
    .from('manual_asset_valuations')
    .select('*')
    .eq('manual_asset_id', id)
    .order('valuation_date', { ascending: false })
  if (valuationError) {
    throw new Error(valuationError.message)
  }
  const valuations = manualAssetValuationRowSchema
    .array()
    .parse(valuationRows ?? [])

  const { data: incomeRows, error: incomeError } = await supabase
    .from('manual_asset_income')
    .select('*')
    .eq('manual_asset_id', id)
    .order('received_date', { ascending: false })
  if (incomeError) {
    throw new Error(incomeError.message)
  }
  const income = manualAssetIncomeRowSchema.array().parse(incomeRows ?? [])

  return { asset, income, valuations }
}

/**
 * Every income event across every manual asset, for the dashboard's income
 * breakdown card (mirrors `getRentalIncomeEvents`). Currency is inherited
 * from the parent asset, same as valuations.
 */
export async function getManualAssetIncomeEvents(): Promise<
  { amountCents: number; currency: string; receivedDate: string }[]
> {
  await requireUser()
  const supabase = await createClient()
  const [incomeRes, assetsRes] = await Promise.all([
    supabase
      .from('manual_asset_income')
      .select('manual_asset_id, amount_cents, received_date'),
    supabase.from('manual_assets').select('id, currency'),
  ])
  if (incomeRes.error) {
    throw new Error(incomeRes.error.message)
  }
  if (assetsRes.error) {
    throw new Error(assetsRes.error.message)
  }
  const currencyByAssetId = new Map(
    (assetsRes.data ?? []).map((a) => [String(a.id), String(a.currency)])
  )
  return (incomeRes.data ?? []).map((r) => ({
    amountCents: Number(r.amount_cents),
    currency: currencyByAssetId.get(String(r.manual_asset_id)) ?? '',
    receivedDate: String(r.received_date),
  }))
}

/**
 * Portfolio value per currency (open assets only), for the main dashboard
 * wealth rollup. Cheap: one select, no per-asset metrics.
 */
export async function getManualAssetsValueByCurrency(): Promise<
  { currency: string; valueCents: number }[]
> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('manual_assets')
    .select('currency, current_value_cents, is_closed')
  if (error) {
    throw new Error(error.message)
  }
  const byCurrency = new Map<string, number>()
  for (const a of data ?? []) {
    if (a.is_closed) {
      continue
    }
    const ccy = String(a.currency)
    byCurrency.set(
      ccy,
      (byCurrency.get(ccy) ?? 0) + Number(a.current_value_cents)
    )
  }
  return [...byCurrency.entries()].map(([currency, cents]) => ({
    currency,
    valueCents: cents,
  }))
}
