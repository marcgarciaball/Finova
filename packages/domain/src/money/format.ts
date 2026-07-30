import type { Money } from './money'

// Keyed by `${locale}:${currency}` — the (locale, currency) space is small and
// bounded (a couple of supported locales × a curated currency list), so a
// module-scope cache avoids reconstructing an Intl.NumberFormat (an expensive
// allocation) on every single format() call across every request.
const currencyFormatters = new Map<string, Intl.NumberFormat>()

function currencyFormatter(
  locale: string,
  currency: string
): Intl.NumberFormat {
  const key = `${locale}:${currency}`
  let fmt = currencyFormatters.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    currencyFormatters.set(key, fmt)
  }
  return fmt
}

/**
 * Format Money for display in the given locale. Always renders exactly two
 * fraction digits (cents / 100), consistent with the fixed-2-decimal model
 * (ADR-007). Symbol and grouping follow the locale.
 */
export function format(m: Money, locale: string): string {
  return currencyFormatter(locale, m.currency).format(m.amount / 100)
}
