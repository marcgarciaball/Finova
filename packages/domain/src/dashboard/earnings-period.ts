/**
 * Pure month/year period arithmetic for the Earnings card's browsable
 * month/year navigation. ISO date strings only — no `Date` objects escape
 * this module except internally for UTC-safe day/month arithmetic.
 */

export type EarningsView = 'month' | 'year'

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const YEAR_PATTERN = /^\d{4}$/

/** `iso` minus one day, UTC-safe (correctly crosses month/year boundaries). */
export function dayBeforeIso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
}

/** `[start, endExclusive)` for a `YYYY-MM` month. */
export function monthRangeIso(month: string): {
  start: string
  endExclusive: string
} {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return {
    start: `${month}-01`,
    endExclusive: new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10),
  }
}

/** `[start, endExclusive)` for a `YYYY` calendar year. */
export function yearRangeIso(year: string): {
  start: string
  endExclusive: string
} {
  return {
    start: `${year}-01-01`,
    endExclusive: `${Number(year) + 1}-01-01`,
  }
}

/** `[start, endExclusive)` for either a `YYYY-MM` month or `YYYY` year. */
export function periodRangeIso(
  view: EarningsView,
  period: string
): { start: string; endExclusive: string } {
  return view === 'month' ? monthRangeIso(period) : yearRangeIso(period)
}

/**
 * Inclusive end of the period, clipped to `todayIso` so an in-progress
 * month/year never reaches into the future.
 */
export function periodEndIso(
  view: EarningsView,
  period: string,
  todayIso: string
): string {
  const { endExclusive } = periodRangeIso(view, period)
  const inclusiveEnd = dayBeforeIso(endExclusive)
  return inclusiveEnd < todayIso ? inclusiveEnd : todayIso
}

/** Start of the trailing 12-month window ending at `asOfIso`, inclusive. */
export function trailingYearStartIso(asOfIso: string): string {
  const [y, m, d] = asOfIso.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y - 1, m - 1, d + 1)).toISOString().slice(0, 10)
}

/** `period` shifted by `delta` months (month view) or years (year view). */
export function shiftPeriod(
  view: EarningsView,
  period: string,
  delta: number
): string {
  if (view === 'year') {
    return String(Number(period) + delta)
  }
  const [y, m] = period.split('-').map(Number) as [number, number]
  const total = y * 12 + (m - 1) + delta
  const nextYear = Math.floor(total / 12)
  const nextMonth = ((total % 12) + 12) % 12
  return `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`
}

/** The current `YYYY-MM` or `YYYY` period, per `todayIso`. */
export function currentPeriod(view: EarningsView, todayIso: string): string {
  return view === 'month' ? todayIso.slice(0, 7) : todayIso.slice(0, 4)
}

/** `'month'` unless `raw` is exactly `'year'`. */
export function parseEarningsView(raw: string | undefined): EarningsView {
  return raw === 'year' ? 'year' : 'month'
}

/**
 * Validates `raw` against `view`'s expected shape (`YYYY-MM` / `YYYY`),
 * falling back to the current period when missing or malformed.
 */
export function parseEarningsPeriod(
  raw: string | undefined,
  view: EarningsView,
  todayIso: string
): string {
  if (raw === undefined) {
    return currentPeriod(view, todayIso)
  }
  const pattern = view === 'month' ? MONTH_PATTERN : YEAR_PATTERN
  return pattern.test(raw) ? raw : currentPeriod(view, todayIso)
}

/**
 * Clamps `period` to `[earliest, latest]`. Lexical string comparison matches
 * calendar order for both `YYYY-MM` and `YYYY` shapes (zero-padded, same
 * length), so no date parsing is needed.
 */
export function clampPeriod(
  period: string,
  earliest: string,
  latest: string
): string {
  if (period < earliest) {
    return earliest
  }
  if (period > latest) {
    return latest
  }
  return period
}

/** Earliest ISO date in `dates`, or `null` if empty. Lexical min == chronological min. */
export function earliestIso(dates: string[]): string | null {
  return dates.length === 0 ? null : dates.reduce((a, b) => (a < b ? a : b))
}
