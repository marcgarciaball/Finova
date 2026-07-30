// Keyed by `${locale}:${JSON.stringify(options)}` — locale and date-format
// options are both drawn from a small, bounded set, so a module-scope cache
// avoids reconstructing an Intl.DateTimeFormat (an expensive allocation) on
// every call across every request.
const dateFormatters = new Map<string, Intl.DateTimeFormat>()

export function getDateFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  const key = `${locale}:${JSON.stringify(options)}`
  let fmt = dateFormatters.get(key)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, options)
    dateFormatters.set(key, fmt)
  }
  return fmt
}
