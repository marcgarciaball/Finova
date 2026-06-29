/**
 * Dashboard period selection (P4-04). Pure and deterministic — the caller
 * passes `todayIso` (UTC `YYYY-MM-DD`) so this never reads the clock and stays
 * unit-testable. The dashboard fetches all rows once and slices them in-domain
 * by the selected period; balances/trend deliberately ignore the period (a
 * balance is cumulative), so only the period-sensitive cores use this.
 */

export type Period = '30d' | '90d' | 'ytd' | '12m' | 'all'

export const PERIODS: readonly Period[] = ['30d', '90d', 'ytd', '12m', 'all']

const DEFAULT_PERIOD: Period = '90d'

export function parsePeriod(raw: string | undefined): Period {
  return PERIODS.includes(raw as Period) ? (raw as Period) : DEFAULT_PERIOD
}

const dayMs = 24 * 60 * 60 * 1000

/** Inclusive lower-bound ISO date for a period, or null for 'all'. */
export function periodStartIso(
  period: Period,
  todayIso: string
): string | null {
  if (period === 'all') return null

  const [y, m, d] = todayIso.split('-').map(Number) as [number, number, number]
  const today = Date.UTC(y, m - 1, d)

  switch (period) {
    case 'ytd':
      return `${String(y).padStart(4, '0')}-01-01`
    case '12m':
      return new Date(Date.UTC(y - 1, m - 1, d)).toISOString().slice(0, 10)
    case '30d':
      return new Date(today - 30 * dayMs).toISOString().slice(0, 10)
    case '90d':
      return new Date(today - 90 * dayMs).toISOString().slice(0, 10)
  }
}

/** Keep rows whose `occurred_at` date is on/after the period start. */
export function filterByPeriod<T extends { occurred_at: string }>(
  txns: T[],
  period: Period,
  todayIso: string
): T[] {
  const start = periodStartIso(period, todayIso)
  if (start === null) return txns
  return txns.filter((t) => t.occurred_at.slice(0, 10) >= start)
}
