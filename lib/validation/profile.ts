import { z } from 'zod'

/**
 * Profile validation (P5-01 Settings).
 *
 * `updateProfileSchema` validates the currency preferences a user can change in
 * the Profile tab. Language (cookie/next-intl) and theme (next-themes) are owned
 * by their existing switchers, so they are deliberately not part of this schema.
 *
 * The `^[A-Z]{3}$` shape mirrors the DB check constraints on
 * `profiles.base_currency` / `display_currency`, so a bad code fails as a clean
 * validation error rather than an opaque write error.
 */
const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'invalidCurrency')

export const updateProfileSchema = z.object({
  baseCurrency: currencyCodeSchema,
  displayCurrency: currencyCodeSchema,
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

/** The persisted `profiles` row, parsed safely at the data boundary. */
export const profileRowSchema = z.object({
  id: z.string().min(1),
  base_currency: z.string(),
  display_currency: z.string(),
  locale: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type ProfileRow = z.infer<typeof profileRowSchema>

/**
 * Account-deletion confirmation check (P5-02). The user must type their own
 * email to confirm the irreversible delete; the match is trim + case-insensitive
 * so trailing spaces or a capitalized address still confirm. Pure and testable;
 * the server action re-runs this against the JWT email (never the client).
 */
export function emailConfirmationMatches(
  input: string,
  email: string
): boolean {
  const normalize = (s: string): string => s.trim().toLowerCase()
  return email.length > 0 && normalize(input) === normalize(email)
}
