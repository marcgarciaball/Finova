/**
 * Prior-period comparison (dashboard deltas). Pure and deterministic — the
 * caller passes `todayIso` (UTC YYYY-MM-DD) so this never reads the clock.
 * The "previous period" is the equal-length window immediately preceding the
 * current period; 'all' has no prior window (returns null / []).
 *
 * No DB work: the dashboard already loads the full transaction history, so a
 * delta is just a second in-memory slice.
 */
import { type Period, periodStartIso } from './period'

const dayMs = 24 * 60 * 60 * 1000

const toIso = (utcMs: number): string =>
  new Date(utcMs).toISOString().slice(0, 10)

const utcOf = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return Date.UTC(y, m - 1, d)
}

/** The equal-length window immediately before the current period, or null. */
export function previousPeriodRange(
  period: Period,
  todayIso: string
): { startIso: string; endExclusiveIso: string } | null {
  const start = periodStartIso(period, todayIso)
  if (start === null) return null
  const lengthDays = Math.round((utcOf(todayIso) - utcOf(start)) / dayMs)
  const endExclusiveIso = start
  const startIso = toIso(utcOf(start) - lengthDays * dayMs)
  return { startIso, endExclusiveIso }
}

/** Rows whose date falls in the prior window [startIso, endExclusiveIso). */
export function previousPeriodTxns<T extends { occurred_at: string }>(
  txns: T[],
  period: Period,
  todayIso: string
): T[] {
  const range = previousPeriodRange(period, todayIso)
  if (range === null) return []
  return txns.filter((t) => {
    const day = t.occurred_at.slice(0, 10)
    return day >= range.startIso && day < range.endExclusiveIso
  })
}

/**
 * Percentage change of `current` vs `previous`, rounded to a whole number.
 * Returns null when the baseline is ≤ 0 (the change is undefined — don't fake
 * a "+∞%"); callers hide the delta in that case.
 */
export function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

export type Trend = 'up' | 'down' | 'flat'

/** Direction of `current` relative to `previous`. Equal (incl. 0/0) is flat. */
export function trendOf(current: number, previous: number): Trend {
  if (current > previous) return 'up'
  if (current < previous) return 'down'
  return 'flat'
}
