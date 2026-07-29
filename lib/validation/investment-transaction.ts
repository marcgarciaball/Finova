import {
  FUNDING_SOURCES,
  INVESTMENT_TXN_TYPES,
} from '@finova/domain/investments/types'
import { fromDecimal } from '@finova/domain/money'
import { z } from 'zod'
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

/** Credit is only meaningful for buys; sells always settle to own funds. */
function clearFundingOnSell<T extends { type: string }>(
  v: T
): T & { fundingNote?: string; fundingSource: string } {
  return v.type === 'buy'
    ? (v as T & { fundingNote?: string; fundingSource: string })
    : { ...v, fundingNote: undefined, fundingSource: 'own_funds' }
}

const investmentTransactionFields = {
  assetId: z.string().uuid(),
  currency: currencySchema,
  fees: decimalString.default('0'),
  fundingNote: z
    .string()
    .trim()
    .max(200, 'invalid')
    .optional()
    .transform((v) => (v ? v : undefined)),
  fundingSource: z.enum(FUNDING_SOURCES).default('own_funds'),
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
}

export const createInvestmentTransactionSchema = z
  .object(investmentTransactionFields)
  .transform(clearFundingOnSell)

export type CreateInvestmentTransactionInput = z.infer<
  typeof createInvestmentTransactionSchema
>

export const updateInvestmentTransactionSchema = z
  .object({
    ...investmentTransactionFields,
    editReason: z
      .string()
      .trim()
      .max(200, 'invalid')
      .optional()
      .transform((v) => (v ? v : undefined)),
    id: z.string().uuid(),
  })
  .transform(clearFundingOnSell)

export type UpdateInvestmentTransactionInput = z.infer<
  typeof updateInvestmentTransactionSchema
>

/** Decimal-string major units → integer cents (money module, no floats). */
export function parseAmountToCents(input: string, currency: string): number {
  return fromDecimal(Number(input), currency).amount
}
