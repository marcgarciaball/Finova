import {
  EXPENSE_CATEGORIES,
  LOAN_TYPES,
  PROPERTY_TYPES,
  RATE_TYPES,
  RECURRENCES,
  VALUATION_SOURCES,
} from '@finova/domain/real-estate/types'
import { z } from 'zod'
import { currencySchema } from '@/lib/validation/account'

/**
 * Real-estate row schemas (runtime shape of every Supabase row, parsed at the
 * data boundary) and form-input schemas. Decimal amounts arrive as strings in
 * major units; actions convert them to integer cents via the money module.
 */

const idSchema = z.string().min(1)
const centsSchema = z.coerce.number().int()
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalidDate')

export const propertyRowSchema = z.object({
  id: idSchema,
  user_id: idSchema,
  name: z.string(),
  type: z.enum(PROPERTY_TYPES),
  address: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string(),
  currency: currencySchema,
  purchase_date: isoDateSchema,
  purchase_price_cents: centsSchema.nonnegative(),
  purchase_fees_cents: centsSchema.nonnegative(),
  current_value_cents: centsSchema.nonnegative(),
  last_valued_at: isoDateSchema,
  ownership_pct: z.coerce.number().gt(0).lte(100),
  is_rented: z.boolean(),
  rental_start_date: isoDateSchema.nullable(),
  rental_end_date: isoDateSchema.nullable(),
  current_rent_cents: centsSchema.nonnegative().nullable(),
  is_sold: z.boolean(),
  sold_date: isoDateSchema.nullable(),
  sold_price_cents: centsSchema.nullable(),
  sold_fees_cents: centsSchema.nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type PropertyRow = z.infer<typeof propertyRowSchema>

export const propertyLoanRowSchema = z.object({
  id: idSchema,
  user_id: idSchema,
  property_id: idSchema,
  lender_name: z.string(),
  loan_type: z.enum(LOAN_TYPES),
  currency: currencySchema,
  original_amount_cents: centsSchema.nonnegative(),
  outstanding_cents: centsSchema.nonnegative(),
  interest_rate_pct: z.coerce.number(),
  rate_type: z.enum(RATE_TYPES),
  start_date: isoDateSchema,
  end_date: isoDateSchema.nullable(),
  monthly_payment_cents: centsSchema.nonnegative(),
  euribor_spread_pct: z.coerce.number().nullable(),
  last_review_date: isoDateSchema.nullable(),
  notes: z.string().nullable(),
  is_paid_off: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type PropertyLoanRow = z.infer<typeof propertyLoanRowSchema>

export const rentalIncomeRowSchema = z.object({
  id: idSchema,
  user_id: idSchema,
  property_id: idSchema,
  period_start: isoDateSchema,
  period_end: isoDateSchema,
  amount_cents: centsSchema.nonnegative(),
  currency: currencySchema,
  tenant_name: z.string().nullable(),
  is_paid: z.boolean(),
  notes: z.string().nullable(),
  created_at: z.string(),
})
export type RentalIncomeRow = z.infer<typeof rentalIncomeRowSchema>

export const propertyExpenseRowSchema = z.object({
  id: idSchema,
  user_id: idSchema,
  property_id: idSchema,
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string(),
  amount_cents: centsSchema.nonnegative(),
  currency: currencySchema,
  expense_date: isoDateSchema,
  is_recurring: z.boolean(),
  recurrence: z.enum(RECURRENCES).nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
})
export type PropertyExpenseRow = z.infer<typeof propertyExpenseRowSchema>

export const propertyValuationRowSchema = z.object({
  id: idSchema,
  user_id: idSchema,
  property_id: idSchema,
  valuation_date: isoDateSchema,
  value_cents: centsSchema.nonnegative(),
  source: z.enum(VALUATION_SOURCES).nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
})
export type PropertyValuationRow = z.infer<typeof propertyValuationRowSchema>

// ---------------------------------------------------------------------------
// Form inputs

const decimalString = z
  .string()
  .trim()
  .regex(/^\d+([.,]\d{1,2})?$/, 'invalidAmount')

/** Percent as decimal string, up to 3 dp (e.g. "3.25" or "0,990"). */
const percentString = z
  .string()
  .trim()
  .regex(/^\d{1,3}([.,]\d{1,3})?$/, 'invalidPercent')

/** Ownership share as a decimal string, up to 2 dp, in (0, 100]. */
const ownershipPctString = z
  .string()
  .trim()
  .regex(/^\d{1,3}([.,]\d{1,2})?$/, 'invalidPercent')
  .refine((v) => {
    const n = normalizeDecimal(v)
    return n > 0 && n <= 100
  }, 'invalidPercent')

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, 'tooLong')
    .optional()
    .transform((v) => (v ? v : undefined))

export const createPropertySchema = z
  .object({
    name: z.string().trim().min(1, 'required').max(120, 'tooLong'),
    type: z.enum(PROPERTY_TYPES),
    address: optionalText(200),
    city: optionalText(80),
    country: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}$/, 'invalidCountry')
      .default('ES'),
    currency: currencySchema,
    purchaseDate: isoDateSchema,
    purchasePrice: decimalString,
    purchaseFees: decimalString.default('0'),
    currentValue: decimalString,
    ownershipPct: ownershipPctString.default('100'),
    isRented: z.boolean().default(false),
    rentalStartDate: isoDateSchema.optional(),
    rentalEndDate: isoDateSchema.optional(),
    currentRent: decimalString.optional(),
    notes: optionalText(500),
  })
  .refine(
    (v) =>
      !(v.rentalStartDate && v.rentalEndDate) ||
      v.rentalEndDate >= v.rentalStartDate,
    { message: 'endBeforeStart', path: ['rentalEndDate'] }
  )
export type CreatePropertyInput = z.infer<typeof createPropertySchema>

export const updatePropertySchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'required').max(120, 'tooLong'),
  type: z.enum(PROPERTY_TYPES),
  address: optionalText(200),
  city: optionalText(80),
  ownershipPct: ownershipPctString,
  isRented: z.boolean(),
  rentalStartDate: isoDateSchema.optional(),
  rentalEndDate: isoDateSchema.optional(),
  currentRent: decimalString.optional(),
  notes: optionalText(500),
})
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>

export const sellPropertySchema = z.object({
  id: z.string().uuid(),
  soldDate: isoDateSchema,
  soldPrice: decimalString,
  soldFees: decimalString.default('0'),
})
export type SellPropertyInput = z.infer<typeof sellPropertySchema>

export const createLoanSchema = z.object({
  propertyId: z.string().uuid(),
  lenderName: z.string().trim().min(1, 'required').max(120, 'tooLong'),
  loanType: z.enum(LOAN_TYPES),
  originalAmount: decimalString,
  outstanding: decimalString,
  interestRatePct: percentString,
  rateType: z.enum(RATE_TYPES),
  startDate: isoDateSchema,
  endDate: isoDateSchema.optional(),
  monthlyPayment: decimalString,
  euriborSpreadPct: percentString.optional(),
  notes: optionalText(500),
})
export type CreateLoanInput = z.infer<typeof createLoanSchema>

export const updateLoanSchema = z.object({
  id: z.string().uuid(),
  outstanding: decimalString,
  interestRatePct: percentString,
  monthlyPayment: decimalString,
  isPaidOff: z.boolean(),
})
export type UpdateLoanInput = z.infer<typeof updateLoanSchema>

export const createRentalIncomeSchema = z
  .object({
    propertyId: z.string().uuid(),
    periodStart: isoDateSchema,
    periodEnd: isoDateSchema,
    /** How `amount` is meant: the period total, or a monthly rent. */
    amountKind: z.enum(['total', 'monthly']).default('total'),
    amount: decimalString,
    tenantName: optionalText(120),
    isPaid: z.boolean().default(true),
    notes: optionalText(500),
  })
  .refine((v) => v.periodEnd >= v.periodStart, {
    message: 'endBeforeStart',
    path: ['periodEnd'],
  })
export type CreateRentalIncomeInput = z.infer<typeof createRentalIncomeSchema>

export const updateRentalIncomeSchema = z
  .object({
    id: z.string().uuid(),
    periodStart: isoDateSchema,
    periodEnd: isoDateSchema,
    /** How `amount` is meant: the period total, or a monthly rent. */
    amountKind: z.enum(['total', 'monthly']).default('total'),
    amount: decimalString,
    tenantName: optionalText(120),
    isPaid: z.boolean().default(true),
    notes: optionalText(500),
  })
  .refine((v) => v.periodEnd >= v.periodStart, {
    message: 'endBeforeStart',
    path: ['periodEnd'],
  })
export type UpdateRentalIncomeInput = z.infer<typeof updateRentalIncomeSchema>

export const createExpenseSchema = z
  .object({
    propertyId: z.string().uuid(),
    category: z.enum(EXPENSE_CATEGORIES),
    description: z.string().trim().min(1, 'required').max(200, 'tooLong'),
    amount: decimalString,
    expenseDate: isoDateSchema,
    isRecurring: z.boolean().default(false),
    recurrence: z.enum(RECURRENCES).optional(),
    notes: optionalText(500),
  })
  .refine((v) => !v.isRecurring || v.recurrence, {
    message: 'required',
    path: ['recurrence'],
  })
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>

export const createValuationSchema = z.object({
  propertyId: z.string().uuid(),
  valuationDate: isoDateSchema,
  value: decimalString,
  source: z.enum(VALUATION_SOURCES).default('manual'),
  notes: optionalText(500),
})
export type CreateValuationInput = z.infer<typeof createValuationSchema>

/** "1.234,56"-tolerant decimal string → number of major units. */
export function normalizeDecimal(input: string): number {
  return Number(input.replace(',', '.'))
}
