/**
 * Key-stats strip core (UD-08). Pure and deterministic — no I/O, no clock.
 *
 * The headline activity stats the dashboard's KPI/summary cores don't give you:
 * a spending average, the single biggest expense, the busiest day, and the
 * transaction count. Computed **per currency** (the domain never sums across
 * currencies) and **excluding transfers** (a transfer moves money between the
 * user's own accounts — it is neither income nor spending nor "activity" worth
 * counting here), consistent with the totals / by-category / over-time cores.
 *
 * "Spending" is the *negative* sign of `amount_cents` (ADR-007), reported as a
 * positive magnitude. `averageSpend` is rounded to whole cents so it stays a
 * clean monetary figure.
 */

export type StatTxn = {
  /** Signed minor units — `−` is an expense. */
  amount_cents: number
  currency: string
  description: string
  is_transfer: boolean
  /** UTC ISO datetime; the day is its `YYYY-MM-DD` prefix (P2-08). */
  occurred_at: string
}

export interface BiggestExpense {
  /** Positive magnitude of the largest single outflow, in cents. */
  amountCents: number
  description: string
  occurredAt: string
}

export interface BusiestDay {
  /** Number of non-transfer transactions on that day. */
  count: number
  /** `YYYY-MM-DD`. */
  day: string
}

export interface KeyStats {
  /** Mean expense magnitude over expense rows, whole cents; null if none. */
  averageSpend: number | null
  /** The single largest expense, or null when there is no spending. */
  biggestExpense: BiggestExpense | null
  /** The day with the most non-transfer transactions, or null when none. */
  busiestDay: BusiestDay | null
  /** Number of non-transfer transactions. */
  count: number
}

export function keyStats(txns: StatTxn[]): Record<string, KeyStats> {
  type Acc = {
    count: number
    expenseTotal: number
    expenseCount: number
    biggest: BiggestExpense | null
    perDay: Map<string, number>
  }
  const byCurrency = new Map<string, Acc>()

  for (const txn of txns) {
    if (txn.is_transfer) continue
    let acc = byCurrency.get(txn.currency)
    if (!acc) {
      acc = {
        count: 0,
        expenseTotal: 0,
        expenseCount: 0,
        biggest: null,
        perDay: new Map(),
      }
      byCurrency.set(txn.currency, acc)
    }

    acc.count += 1
    const day = txn.occurred_at.slice(0, 10)
    acc.perDay.set(day, (acc.perDay.get(day) ?? 0) + 1)

    if (txn.amount_cents < 0) {
      const magnitude = Math.abs(txn.amount_cents)
      acc.expenseTotal += magnitude
      acc.expenseCount += 1
      if (!acc.biggest || magnitude > acc.biggest.amountCents) {
        acc.biggest = {
          amountCents: magnitude,
          description: txn.description,
          occurredAt: txn.occurred_at,
        }
      }
    }
  }

  const out: Record<string, KeyStats> = {}
  for (const [currency, acc] of byCurrency) {
    let busiestDay: BusiestDay | null = null
    for (const [day, count] of acc.perDay) {
      // Most transactions wins; ties broken by the earliest day.
      if (
        !busiestDay ||
        count > busiestDay.count ||
        (count === busiestDay.count && day < busiestDay.day)
      ) {
        busiestDay = { day, count }
      }
    }
    out[currency] = {
      count: acc.count,
      averageSpend:
        acc.expenseCount === 0
          ? null
          : Math.round(acc.expenseTotal / acc.expenseCount),
      biggestExpense: acc.biggest,
      busiestDay,
    }
  }
  return out
}
