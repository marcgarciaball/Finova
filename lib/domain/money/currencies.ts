/**
 * Curated ISO-4217 currency list for the pickers (P5-01).
 *
 * Not exhaustive — a focused set covering the app's likely users (ES-first,
 * plus the major world currencies). Codes are the source for the currency
 * `<select>`s; runtime validation elsewhere still only enforces the
 * `^[A-Z]{3}$` shape (matching the DB check), so a code outside this list that
 * already lives on a row is never rejected — this list only bounds *new* picks.
 */
export interface CurrencyOption {
  code: string
  /** English display name; the picker shows `code — name`. */
  name: string
}

export const CURRENCIES: readonly CurrencyOption[] = [
  { code: 'EUR', name: 'Euro' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'PLN', name: 'Polish Zloty' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'ARS', name: 'Argentine Peso' },
  { code: 'INR', name: 'Indian Rupee' },
] as const

const CODES = new Set(CURRENCIES.map((c) => c.code))

/** Is `code` one of the curated pickable currencies? */
export function isKnownCurrency(code: string): boolean {
  return CODES.has(code)
}
