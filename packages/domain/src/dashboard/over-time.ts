/**
 * Time-series dashboard cores (P4-03). Pure and deterministic.
 *
 * Two series, deliberately computed separately because they treat transfers
 * differently:
 *
 *  - `monthlySeries` — per-month income/expense/net, **transfers excluded**
 *    (the P1-06 invariant: a transfer is not income or expense).
 *  - `balanceTrend` — the cumulative account balance per month, **transfers
 *    included** (they move money through an account, so they change its
 *    balance), starting from a per-currency opening baseline. Its final point
 *    equals the P4-01 `accountBalances` total for that currency.
 *
 * Buckets are UTC `YYYY-MM` (`occurred_at.slice(0, 7)`) — `occurred_at` is
 * stored UTC (P2-08), so no timezone math. Both series are per currency (never
 * summed across) and sparse + sorted ascending (no invented date range).
 */

export type TimedTxn = {
  /** Signed minor units — `+` inflow, `−` outflow. */
  amount_cents: number
  currency: string
  is_transfer: boolean
  /** ISO timestamp; bucketed by its first 7 chars (YYYY-MM). */
  occurred_at: string
}

export interface MonthBucket {
  /** Positive magnitude of outflows in the month, in cents. */
  expense: number
  income: number
  /** income − expense, in cents. */
  net: number
  period: string
}

export interface TrendPoint {
  /** Cumulative balance through the end of this month, in cents. */
  balance: number
  period: string
}

const monthOf = (occurredAt: string): string => occurredAt.slice(0, 7)

export const GRANULARITIES = ['day', 'month', 'year'] as const
export type Granularity = (typeof GRANULARITIES)[number]

/** `YYYY-MM-DD` / `YYYY-MM` / `YYYY` — the UTC ISO prefix per granularity. */
const PREFIX_LEN: Record<Granularity, number> = { day: 10, month: 7, year: 4 }

export function parseGranularity(raw: string | undefined): Granularity {
  return (GRANULARITIES as readonly string[]).includes(raw ?? '')
    ? (raw as Granularity)
    : 'month'
}

/**
 * Per-currency income/expense/net bucketed by day, month, or year —
 * transfers excluded, period asc. `monthlySeries` is the month special case.
 */
export function incomeExpenseSeries(
  txns: TimedTxn[],
  granularity: Granularity
): Record<string, MonthBucket[]> {
  const len = PREFIX_LEN[granularity]
  // currency -> period -> {income, expense}
  const byCurrency = new Map<
    string,
    Map<string, { income: number; expense: number }>
  >()

  for (const txn of txns) {
    if (txn.is_transfer) continue
    let periods = byCurrency.get(txn.currency)
    if (!periods) {
      periods = new Map()
      byCurrency.set(txn.currency, periods)
    }
    const period = txn.occurred_at.slice(0, len)
    const bucket = periods.get(period) ?? { income: 0, expense: 0 }
    if (txn.amount_cents >= 0) bucket.income += txn.amount_cents
    else bucket.expense += Math.abs(txn.amount_cents)
    periods.set(period, bucket)
  }

  const out: Record<string, MonthBucket[]> = {}
  for (const [currency, periods] of byCurrency) {
    out[currency] = [...periods.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([period, { income, expense }]) => ({
        period,
        income,
        expense,
        net: income - expense,
      }))
  }
  return out
}

/** Per-currency monthly income/expense/net, transfers excluded, period asc. */
export function monthlySeries(txns: TimedTxn[]): Record<string, MonthBucket[]> {
  return incomeExpenseSeries(txns, 'month')
}

/**
 * Per-currency cumulative balance by month (transfers included), period asc.
 * `opening` maps a currency to its starting balance in cents (default 0).
 */
export function balanceTrend(
  txns: TimedTxn[],
  opening: Record<string, number> = {}
): Record<string, TrendPoint[]> {
  // currency -> period -> net signed delta in that month
  const byCurrency = new Map<string, Map<string, number>>()

  for (const txn of txns) {
    let months = byCurrency.get(txn.currency)
    if (!months) {
      months = new Map()
      byCurrency.set(txn.currency, months)
    }
    const period = monthOf(txn.occurred_at)
    months.set(period, (months.get(period) ?? 0) + txn.amount_cents)
  }

  const out: Record<string, TrendPoint[]> = {}
  for (const [currency, months] of byCurrency) {
    let running = opening[currency] ?? 0
    out[currency] = [...months.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([period, delta]) => {
        running += delta
        return { period, balance: running }
      })
  }
  return out
}
