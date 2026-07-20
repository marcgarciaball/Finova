import { ACCOUNT_TYPES } from '@finova/domain/accounts/types'
import { fromDecimal } from '@finova/domain/money'
import { z } from 'zod'

/**
 * Account validation (P1-02).
 *
 * Two distinct concerns live here:
 *  - input schemas (`createAccountSchema`/`updateAccountSchema`) validate what
 *    the form sends, as strings;
 *  - `accountRowSchema` is the single source of truth for the runtime shape of
 *    a Supabase row, parsed at the data boundary into the domain `Account`.
 *
 * Money is never floated: `parseOpeningBalanceToCents` defers to the P1-01
 * money module (string parse → integer cents).
 */

export const accountTypeSchema = z.enum(ACCOUNT_TYPES)

export const currencySchema = z.string().regex(/^[A-Z]{3}$/, 'invalidCurrency')

/**
 * The opening balance the form sends: a decimal string in major units, e.g.
 * "1234.56" or "-50". Optional, defaults to "0". This schema only proves the
 * string is a well-formed decimal; the action converts it to cents.
 */
export const openingBalanceSchema = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d+)?$/, 'invalidAmount')
  .default('0')

const nameSchema = z
  .string()
  .trim()
  .min(1, 'nameRequired')
  .max(100, 'nameTooLong')

/**
 * Optional annual interest rate the form sends, as a percentage string
 * (e.g. "2" or "2.5"). Empty/absent ⇒ no rate. `parseInterestRateToBps`
 * converts the accepted value into the integer basis points the column
 * stores (max 100.00%, matching the DB check constraint).
 */
export const interestRateSchema = z
  .union([
    z.literal(''),
    z
      .string()
      .trim()
      .regex(/^\d+(\.\d+)?$/, 'invalidRate'),
  ])
  .optional()

export const createAccountSchema = z.object({
  name: nameSchema,
  type: accountTypeSchema,
  currency: currencySchema,
  openingBalance: openingBalanceSchema,
  interestRate: interestRateSchema,
})

export const updateAccountSchema = createAccountSchema.extend({
  id: z.string().uuid(),
})

export type CreateAccountInput = z.infer<typeof createAccountSchema>
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>

/**
 * Parse a raw Supabase `accounts` row into a typed, validated domain account.
 * `opening_balance` arrives as a number (bigint mode 'number') and is coerced
 * defensively in case the driver hands back a string.
 */
export const accountRowSchema = z.object({
  // id/user_id come straight from Postgres (validated there); we only assert
  // shape at this boundary, not RFC-4122 version specifics.
  id: z.string().min(1),
  user_id: z.string().min(1),
  name: z.string(),
  type: accountTypeSchema,
  currency: currencySchema,
  opening_balance: z.coerce.number().int(),
  interest_rate_bps: z.coerce.number().int().nullable(),
  archived: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type AccountRow = z.infer<typeof accountRowSchema>

/**
 * Convert a validated decimal-string opening balance into integer cents,
 * via the money module (no float drift). Throws on malformed input or a bad
 * currency — callers should validate with the schemas first.
 */
export function parseOpeningBalanceToCents(
  input: string,
  currency: string
): number {
  return fromDecimal(Number(input), currency).amount
}

/**
 * Convert a validated percentage string ("2", "2.5") into integer basis
 * points (200, 250). Empty/undefined ⇒ no rate (null clears it on update).
 */
export function parseInterestRateToBps(
  input: string | undefined
): number | null {
  if (!input) {
    return null
  }
  return Math.round(Number(input) * 100)
}
