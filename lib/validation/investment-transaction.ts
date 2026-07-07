import { z } from 'zod'
import { INVESTMENT_TXN_TYPES } from '@/lib/domain/investments/types'
import { fromDecimal } from '@/lib/domain/money'
import { currencySchema } from '@/lib/validation/account'

/**
 * Add-transaction form input (Inversiones A4). Decimal amounts arrive as
 * strings in major units and are converted to integer cents by the action via
 * the money module; quantity stays a decimal string (numeric(20,8) column)
 * and is passed through to Postgres as-is to preserve precision.
 */

const decimalString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, 'invalidAmount')

const quantityStringSchema = decimalString
  .refine((v) => (v.split('.')[1] ?? '').length <= 8, 'tooManyDecimals')
  .refine((v) => Number(v) > 0, 'mustBePositive')

export const createInvestmentTransactionSchema = z.object({
  assetId: z.string().uuid(),
  currency: currencySchema,
  fees: decimalString.default('0'),
  notes: z
    .string()
    .trim()
    .max(500, 'notesTooLong')
    .optional()
    .transform((v) => (v ? v : undefined)),
  price: decimalString,
  quantity: quantityStringSchema,
  tradedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'invalidDate')
    .refine((v) => v <= new Date().toISOString().slice(0, 10), 'futureDate'),
  type: z.enum(INVESTMENT_TXN_TYPES),
})

export type CreateInvestmentTransactionInput = z.infer<
  typeof createInvestmentTransactionSchema
>

/** Decimal-string major units → integer cents (money module, no floats). */
export function parseAmountToCents(input: string, currency: string): number {
  return fromDecimal(Number(input), currency).amount
}
