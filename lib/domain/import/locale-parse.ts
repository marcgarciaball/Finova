/**
 * Locale-resilient parsing for imported bank data (P2-05).
 *
 * Bank exports vary by locale: amounts come as `1.234,56` (es) or `1,234.56`
 * (en), dates as `dd/mm/yyyy`, `mm/dd/yyyy`, or ISO. These pure helpers
 * normalize both into canonical forms the rest of the app trusts — a decimal
 * string with `.` as the separator (ready for the money module's `fromDecimal`)
 * and an ISO `YYYY-MM-DD` date. No I/O; fully unit-tested.
 *
 * Where a value is genuinely ambiguous (a lone separator, `01/02/2026`), the
 * caller passes an explicit hint from the import template / detected locale —
 * the `auto` fallbacks are best-effort, not a substitute for knowing the source.
 */

export type DecimalSeparator = ',' | '.'

export interface ParseDecimalOptions {
  /** The character used as the decimal point in the source. Omit for `auto`. */
  decimal?: DecimalSeparator
}

/**
 * Normalize a localized amount string to a canonical decimal string (`.` as the
 * decimal point, no grouping separators), or `null` if it isn't a number.
 * Handles currency symbols, spaces (incl. NBSP/thin space), a leading/trailing
 * sign, and accounting-style parentheses for negatives, e.g. `(1.234,56)`.
 */
export function parseDecimalToCanonical(
  raw: string,
  opts: ParseDecimalOptions = {}
): string | null {
  if (typeof raw !== 'string') {
    return null
  }
  let s = raw.trim()
  if (s === '') {
    return null
  }

  // Accounting negatives: (123) → -123.
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }

  // Strip everything that isn't a digit, separator, or sign (currency, spaces).
  s = s.replace(/[^\d.,+-]/g, '')

  // Capture a leading sign, then remove all signs from the body.
  if (s.startsWith('-')) {
    negative = !negative
  }
  s = s.replace(/[+-]/g, '')
  if (s === '') {
    return null
  }

  const hasDot = s.includes('.')
  const hasComma = s.includes(',')

  let decimalChar: DecimalSeparator | null = null
  if (opts.decimal) {
    decimalChar = opts.decimal
  } else if (hasDot && hasComma) {
    // Both present: the rightmost is the decimal point, the other is grouping.
    decimalChar = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.'
  } else if (hasComma) {
    decimalChar = inferLoneSeparator(s, ',')
  } else if (hasDot) {
    decimalChar = inferLoneSeparator(s, '.')
  }

  let intPart: string
  let fracPart = ''
  if (decimalChar) {
    const groupingChar = decimalChar === ',' ? '.' : ','
    const withoutGrouping = s.split(groupingChar).join('')
    const idx = withoutGrouping.lastIndexOf(decimalChar)
    if (idx === -1) {
      intPart = withoutGrouping
    } else {
      intPart = withoutGrouping.slice(0, idx)
      fracPart = withoutGrouping.slice(idx + 1)
    }
  } else {
    // No decimal: every separator was grouping.
    intPart = s.replace(/[.,]/g, '')
  }

  intPart = intPart.replace(/[.,]/g, '')
  if (intPart === '' && fracPart === '') {
    return null
  }
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) {
    return null
  }

  const normalizedInt = intPart === '' ? '0' : intPart
  // Trim trailing fraction zeros so the canonical form is minimal: 50.00 → 50.
  const trimmedFrac = fracPart.replace(/0+$/, '')
  const body = trimmedFrac ? `${normalizedInt}.${trimmedFrac}` : normalizedInt
  if (Number(body) === 0) {
    return '0' // never a signed zero
  }
  return negative ? `-${body}` : body
}

/**
 * A single separator type is ambiguous: `1,234` could be 1234 (grouping) or
 * 1.234 (decimal). Heuristic: treat it as grouping only when it looks like a
 * thousands group — exactly 3 digits follow it and it appears once. Otherwise
 * (1 or 2 trailing digits, or multiple occurrences) it's the decimal point.
 */
function inferLoneSeparator(
  s: string,
  sep: DecimalSeparator
): DecimalSeparator | null {
  const parts = s.split(sep)
  if (parts.length === 2 && parts[1]?.length === 3 && parts[0] !== '') {
    return null // grouping → no decimal
  }
  return sep
}

export type DateOrder = 'dmy' | 'mdy' | 'ymd' | 'auto'

/**
 * Parse a localized date string to ISO `YYYY-MM-DD`, or `null` if invalid.
 * Accepts `/`, `-`, and `.` separators. `order` disambiguates day-vs-month;
 * `auto` infers from any component > 12 and otherwise defaults to `dmy`
 * (Finova's primary locale is ES). 2-digit years map to 2000–2099.
 */
export function parseDateToIso(
  raw: string,
  order: DateOrder = 'auto'
): string | null {
  if (typeof raw !== 'string') {
    return null
  }
  const s = raw.trim()
  const m = s.match(/^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})$/)
  if (!m) {
    return null
  }
  const a = Number(m[1])
  const b = Number(m[2])
  const c = Number(m[3])

  let year: number
  let month: number
  let day: number

  const isoLike = m[1]?.length === 4
  const effectiveOrder = order === 'auto' ? inferOrder(a, b, isoLike) : order

  switch (effectiveOrder) {
    case 'ymd':
      year = a
      month = b
      day = c
      break
    case 'mdy':
      year = c
      month = a
      day = b
      break
    default:
      year = c
      month = b
      day = a
      break
  }

  if (year < 100) {
    year += 2000
  }
  if (!isValidYmd(year, month, day)) {
    return null
  }
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

function inferOrder(a: number, b: number, isoLike: boolean): DateOrder {
  if (isoLike) {
    return 'ymd'
  }
  // If the first component can't be a month but the second can, it's d/m.
  // If the first can be a month and the second can't, it's m/d.
  if (a > 12 && b <= 12) {
    return 'dmy'
  }
  if (b > 12 && a <= 12) {
    return 'mdy'
  }
  return 'dmy'
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) {
    return false
  }
  const daysInMonth = [
    31,
    isLeap(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ]
  return day <= (daysInMonth[month - 1] ?? 0)
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}
