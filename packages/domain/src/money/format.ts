import type { Money } from './money'

/**
 * Format Money for display in the given locale. Always renders exactly two
 * fraction digits (cents / 100), consistent with the fixed-2-decimal model
 * (ADR-007). Symbol and grouping follow the locale.
 */
export function format(m: Money, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: m.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(m.amount / 100)
}
