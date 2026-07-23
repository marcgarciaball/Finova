import {
  MANUAL_ASSET_TYPES,
  MANUAL_VALUATION_SOURCES,
} from '@finova/domain/manual-assets/types'
import { z } from 'zod'
import { currencySchema } from '@/lib/validation/account'

/**
 * Manual-asset row schemas (runtime shape of every Supabase row, parsed at
 * the data boundary) and form-input schemas. Decimal amounts arrive as
 * strings in major units; actions convert them to integer cents via the
 * money module.
 */

const idSchema = z.string().min(1)
const centsSchema = z.coerce.number().int()
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalidDate')

export const manualAssetRowSchema = z.object({
  id: idSchema,
  user_id: idSchema,
  name: z.string(),
  type: z.enum(MANUAL_ASSET_TYPES),
  currency: currencySchema,
  acquisition_date: isoDateSchema,
  cost_basis_cents: centsSchema.nonnegative(),
  current_value_cents: centsSchema.nonnegative(),
  last_valued_at: isoDateSchema,
  is_closed: z.boolean(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type ManualAssetRow = z.infer<typeof manualAssetRowSchema>

export const manualAssetValuationRowSchema = z.object({
  id: idSchema,
  user_id: idSchema,
  manual_asset_id: idSchema,
  valuation_date: isoDateSchema,
  value_cents: centsSchema.nonnegative(),
  source: z.enum(MANUAL_VALUATION_SOURCES).nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
})
export type ManualAssetValuationRow = z.infer<
  typeof manualAssetValuationRowSchema
>

export const manualAssetIncomeRowSchema = z.object({
  id: idSchema,
  user_id: idSchema,
  manual_asset_id: idSchema,
  received_date: isoDateSchema,
  amount_cents: centsSchema.nonnegative(),
  notes: z.string().nullable(),
  created_at: z.string(),
})
export type ManualAssetIncomeRow = z.infer<typeof manualAssetIncomeRowSchema>

// ---------------------------------------------------------------------------
// Form inputs

const decimalString = z
  .string()
  .trim()
  .regex(/^\d+([.,]\d{1,2})?$/, 'invalidAmount')

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, 'tooLong')
    .optional()
    .transform((v) => (v ? v : undefined))

export const createManualAssetSchema = z.object({
  name: z.string().trim().min(1, 'required').max(120, 'tooLong'),
  type: z.enum(MANUAL_ASSET_TYPES),
  currency: currencySchema,
  acquisitionDate: isoDateSchema,
  costBasis: decimalString,
  currentValue: decimalString,
  notes: optionalText(500),
})
export type CreateManualAssetInput = z.infer<typeof createManualAssetSchema>

export const updateManualAssetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'required').max(120, 'tooLong'),
  type: z.enum(MANUAL_ASSET_TYPES),
  isClosed: z.boolean(),
  notes: optionalText(500),
})
export type UpdateManualAssetInput = z.infer<typeof updateManualAssetSchema>

export const createManualAssetValuationSchema = z.object({
  manualAssetId: z.string().uuid(),
  valuationDate: isoDateSchema,
  value: decimalString,
  source: z.enum(MANUAL_VALUATION_SOURCES).default('manual'),
  notes: optionalText(500),
})
export type CreateManualAssetValuationInput = z.infer<
  typeof createManualAssetValuationSchema
>

export const createManualAssetIncomeSchema = z.object({
  manualAssetId: z.string().uuid(),
  receivedDate: isoDateSchema,
  amount: decimalString,
  notes: optionalText(500),
})
export type CreateManualAssetIncomeInput = z.infer<
  typeof createManualAssetIncomeSchema
>

/** "1.234,56"-tolerant decimal string → number of major units. */
export function normalizeDecimal(input: string): number {
  return Number(input.replace(',', '.'))
}
