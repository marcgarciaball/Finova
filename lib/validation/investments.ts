import {
  ASSET_TYPES,
  FUNDING_SOURCES,
  INVESTMENT_TXN_TYPES,
  QUOTE_TYPES,
} from '@finova/domain/investments/types'
import { z } from 'zod'
import { currencySchema } from '@/lib/validation/account'

/**
 * Inversiones row schemas (A1) — the single source of truth for the runtime
 * shape of each Supabase row, parsed at every data boundary (accountRowSchema
 * pattern). Postgres `numeric` may arrive as number or string depending on
 * the driver, so fractional columns coerce; money columns must be integers.
 *
 * Documented limitation: quantities are IEEE doubles in JS — exact for
 * realistic magnitudes (≤ ~9e7 units at 8 dp); money itself is never floated.
 */

/** True when `v` has at most `dp` decimal places (tolerant of float noise). */
export function decimalPlacesAtMost(dp: number) {
  return (v: number) => {
    const scaled = v * 10 ** dp
    return Math.abs(scaled - Math.round(scaled)) < 1e-3
  }
}

const idSchema = z.string().min(1)
const centsSchema = z.coerce.number().int()
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const quantitySchema = z.coerce
  .number()
  .positive()
  .refine(decimalPlacesAtMost(8), 'tooManyDecimals')

export const assetRowSchema = z.object({
  id: idSchema,
  type: z.enum(ASSET_TYPES),
  ticker: z.string().nullable(),
  isin: z.string().nullable(),
  coingecko_id: z.string().nullable(),
  exchange: z.string().nullable(),
  name: z.string(),
  currency: currencySchema,
  provider_meta: z.record(z.string(), z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
})
export type AssetRow = z.infer<typeof assetRowSchema>

export const portfolioRowSchema = z.object({
  id: idSchema,
  user_id: idSchema,
  name: z.string(),
  base_currency: currencySchema,
  created_at: z.string(),
  updated_at: z.string(),
})
export type PortfolioRow = z.infer<typeof portfolioRowSchema>

export const investmentAccountRowSchema = z.object({
  id: idSchema,
  portfolio_id: idSchema,
  user_id: idSchema,
  name: z.string(),
  currency: currencySchema,
  created_at: z.string(),
})
export type InvestmentAccountRow = z.infer<typeof investmentAccountRowSchema>

export const investmentTransactionRowSchema = z.object({
  id: idSchema,
  user_id: idSchema,
  portfolio_id: idSchema,
  account_id: idSchema.nullable(),
  asset_id: idSchema,
  type: z.enum(INVESTMENT_TXN_TYPES),
  quantity: quantitySchema,
  price_cents: centsSchema.nonnegative(),
  currency: currencySchema,
  fees_cents: centsSchema.nonnegative(),
  traded_at: isoDateSchema,
  notes: z.string().nullable(),
  funding_source: z.enum(FUNDING_SOURCES),
  funding_note: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  edited_at: z.string().nullable(),
  edit_reason: z.string().nullable(),
})
export type InvestmentTransactionRow = z.infer<
  typeof investmentTransactionRowSchema
>

export const holdingRowSchema = z.object({
  id: idSchema,
  user_id: idSchema,
  portfolio_id: idSchema,
  asset_id: idSchema,
  quantity: z.coerce
    .number()
    .nonnegative()
    .refine(decimalPlacesAtMost(8), 'tooManyDecimals'),
  avg_cost_cents: centsSchema,
  invested_cents: centsSchema,
  realized_pl_cents: centsSchema,
  current_price_cents: centsSchema.nullable(),
  current_value_cents: centsSchema.nullable(),
  unrealized_pl_cents: centsSchema.nullable(),
  unrealized_pl_pct: z.coerce.number().nullable(),
  dividends_cents: centsSchema,
  last_computed_at: z.string().nullable(),
})
export type HoldingRow = z.infer<typeof holdingRowSchema>

export const cachedQuoteRowSchema = z.object({
  id: idSchema,
  asset_id: idSchema,
  price_cents: centsSchema,
  currency: currencySchema,
  quote_type: z.enum(QUOTE_TYPES),
  stale: z.boolean(),
  provider: z.string(),
  fetched_at: z.string(),
  updated_at: z.string(),
})
export type CachedQuoteRow = z.infer<typeof cachedQuoteRowSchema>

export const portfolioSnapshotRowSchema = z.object({
  id: idSchema,
  portfolio_id: idSchema,
  user_id: idSchema,
  snapshot_date: isoDateSchema,
  total_value_cents: centsSchema,
  base_currency: currencySchema,
})
export type PortfolioSnapshotRow = z.infer<typeof portfolioSnapshotRowSchema>

export const fxRateRowSchema = z.object({
  id: idSchema,
  from_ccy: currencySchema,
  to_ccy: currencySchema,
  rate: z.coerce
    .number()
    .positive()
    .refine(decimalPlacesAtMost(8), 'tooManyDecimals'),
  rate_date: isoDateSchema,
})
export type FxRateRow = z.infer<typeof fxRateRowSchema>
