import { fromDecimal } from '@finova/domain/money'
import { z } from 'zod'
import { currencySchema } from '@/lib/validation/account'

/**
 * Transaction validation (P1-04).
 *
 * Input schemas validate what a (future, P1-05) transaction form sends, as
 * strings; `transactionRowSchema` is the single source of truth for the runtime
 * shape of a Supabase row, parsed at the data boundary into a typed domain
 * shape. Money is never floated: `parseAmountToCents` defers to the P1-01 money
 * module (string parse → integer cents).
 *
 * The amount is **signed** — `+` inflow (income), `−` outflow (expense). A zero
 * amount is rejected (DB has a matching `transactions_amount_nonzero_check`).
 */

const descriptionSchema = z
  .string()
  .trim()
  .min(1, 'descriptionRequired')
  .max(200, 'descriptionTooLong')

/** Treat missing/whitespace-only strings as "absent" so they normalize to null. */
const emptyToNull = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? null : v

const noteSchema = z.preprocess(
  emptyToNull,
  z.string().trim().max(2000, 'noteTooLong').nullable().default(null)
)

/** `categoryId` is optional: omitted/empty → uncategorized (null); a uuid → a category. */
const categoryIdSchema = z.preprocess(
  emptyToNull,
  z.string().uuid().nullable().default(null)
)

/**
 * The amount the form sends: a signed decimal string in major units, e.g.
 * "1234.56" or "-50". This schema only proves the string is a well-formed,
 * non-zero decimal; the action converts it to cents via the money module.
 */
export const amountSchema = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d+)?$/, 'invalidAmount')
  .refine((s) => Number(s) !== 0, 'amountNonZero')

export const tagsSchema = z.array(z.string().trim().min(1)).default([])

export const createTransactionSchema = z.object({
  accountId: z.string().uuid(),
  categoryId: categoryIdSchema,
  amount: amountSchema,
  currency: currencySchema,
  occurredAt: z.coerce.date(),
  description: descriptionSchema,
  note: noteSchema,
  tags: tagsSchema,
  isRecurring: z.boolean().default(false),
})

export const updateTransactionSchema = createTransactionSchema.extend({
  id: z.string().uuid(),
})

/**
 * Two-leg transfer wizard input (roadmap 1.2). The amount is an unsigned
 * decimal string here (a transfer has a magnitude, not a direction) — the sign
 * is applied per-leg by `buildTransferLegs`. `fromAccountId`/`toAccountId` must
 * differ (the app-layer check; a schema-level `refine` can't reference sibling
 * fields as cleanly as a plain comparison in the action).
 */
export const createTransferSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, 'invalidAmount')
    .refine((s) => Number(s) !== 0, 'amountNonZero'),
  currency: currencySchema,
  occurredAt: z.coerce.date(),
  description: descriptionSchema,
})

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>
export type CreateTransferInput = z.infer<typeof createTransferSchema>

/** Parse a raw Supabase `transactions` row into a typed, validated domain shape. */
export const transactionRowSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  account_id: z.string().min(1),
  category_id: z.string().min(1).nullable(),
  amount_cents: z.coerce.number().int(),
  currency: currencySchema,
  occurred_at: z.string(),
  description: z.string(),
  note: z.string().nullable(),
  tags: z.array(z.string()),
  is_transfer: z.boolean(),
  transfer_group_id: z.string().min(1).nullable(),
  is_recurring: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type TransactionRow = z.infer<typeof transactionRowSchema>

/**
 * Convert a validated signed decimal-string amount into integer cents, via the
 * money module (no float drift). Throws on malformed input or a bad currency —
 * callers should validate with the schemas first.
 */
export function parseAmountToCents(input: string, currency: string): number {
  return fromDecimal(Number(input), currency).amount
}
