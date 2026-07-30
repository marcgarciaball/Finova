// Keyed by `${locale}:${currency}` — bounded by the app's supported locales
// and currency list, so a module-scope cache avoids reconstructing an
// Intl.NumberFormat (an expensive allocation) every time a caller re-derives
// its formatter.
const formatters = new Map<string, Intl.NumberFormat>()

function numberFormatter(locale: string, currency: string): Intl.NumberFormat {
  const key = `${locale}:${currency}`
  let fmt = formatters.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    formatters.set(key, fmt)
  }
  return fmt
}

export function currencyFormatter(locale: string, currency: string) {
  const fmt = numberFormatter(locale, currency)
  return (amount: number) =>
    Number.isFinite(amount) ? fmt.format(amount) : '—'
}

const compactFormatters = new Map<string, Intl.NumberFormat>()

/** Short currency form for chart axis ticks (e.g. "50 k €"), so labels stay narrow enough not to get clipped. */
export function compactCurrencyFormatter(locale: string, currency: string) {
  const key = `${locale}:${currency}`
  let fmt = compactFormatters.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    })
    compactFormatters.set(key, fmt)
  }
  return (amount: number) =>
    Number.isFinite(amount) ? fmt.format(amount) : '—'
}
