import {
  DEBT_RATE_TYPES,
  DEBT_STATUSES,
  DEBT_TYPES,
} from '@finova/domain/debts/types'
import { z } from 'zod'
import { currencySchema } from '@/lib/validation/account'

/**
 * Debts row schemas (runtime shape of every Supabase row, parsed at the data
 * boundary) and form-input schemas. Decimal amounts arrive as strings in
 * major units; actions convert them to integer cents via the money module.
 */

const idSchema = z.string().min(1)
const centsSchema = z.coerce.number().int()
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalidDate')
const termMonthsSchema = z.coerce.number().int().positive()

const decimalString = z
  .string()
  .trim()
  .regex(/^\d+([.,]\d{1,2})?$/, 'invalidAmount')

/** Percent as decimal string, up to 3 dp (e.g. "3.25" or "0,990"). */
const percentString = z
  .string()
  .trim()
  .regex(/^\d{1,3}([.,]\d{1,3})?$/, 'invalidPercent')

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, 'tooLong')
    .optional()
    .transform((v) => (v ? v : undefined))

export const debtRowSchema = z.object({
  id: idSchema,
  user_id: idSchema,
  type: z.enum(DEBT_TYPES),
  property_id: idSchema.nullable(),
  lender: z.string(),
  currency: currencySchema,
  principal_cents: centsSchema.nonnegative(),
  outstanding_cents: centsSchema.nonnegative(),
  interest_rate_pct: z.coerce.number(),
  rate_type: z.enum(DEBT_RATE_TYPES),
  term_months: termMonthsSchema,
  start_date: isoDateSchema,
  payment_cents: centsSchema.nonnegative(),
  status: z.enum(DEBT_STATUSES),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type DebtRow = z.infer<typeof debtRowSchema>

export const createDebtSchema = z
  .object({
    type: z.enum(DEBT_TYPES),
    propertyId: z.uuid().optional(),
    lender: z.string().trim().min(1, 'required').max(120, 'tooLong'),
    currency: currencySchema,
    principal: decimalString,
    outstanding: decimalString,
    interestRatePct: percentString,
    rateType: z.enum(DEBT_RATE_TYPES),
    termMonths: termMonthsSchema,
    startDate: isoDateSchema,
    payment: decimalString,
    notes: optionalText(500),
  })
  .refine((v) => v.type !== 'mortgage' || v.propertyId, {
    message: 'required',
    path: ['propertyId'],
  })
export type CreateDebtInput = z.infer<typeof createDebtSchema>

export const updateDebtSchema = z.object({
  id: z.uuid(),
  lender: z.string().trim().min(1, 'required').max(120, 'tooLong'),
  outstanding: decimalString,
  interestRatePct: percentString,
  payment: decimalString,
  status: z.enum(DEBT_STATUSES),
  notes: optionalText(500),
})
export type UpdateDebtInput = z.infer<typeof updateDebtSchema>
