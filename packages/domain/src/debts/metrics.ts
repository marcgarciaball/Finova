/**
 * Pure debts math. `outstandingCents` on a `DebtSnapshot` is the real,
 * user-maintained balance and is what totals/aggregates are built from.
 * The amortization schedule functions below (`amortizationSchedule`,
 * `projectedBalanceCents`, `nextPaymentDate`, `payoffDate`) are a reference
 * projection only — real loans drift from a textbook schedule (rate changes,
 * extra payments), so they never feed back into `outstandingCents`.
 */

export interface DebtSnapshot {
  currency: string
  outstandingCents: number
  status: 'active' | 'paid_off' | 'defaulted'
  type: string
}

export interface CurrencyDebtTotals {
  currency: string
  debtCount: number
  outstandingByType: Partial<Record<string, number>>
  totalOutstandingCents: number
}

export interface AmortizationRow {
  balanceCents: number
  interestCents: number
  month: number
  paymentDate: string
  principalCents: number
}

export interface AmortizableDebt {
  interestRatePct: number
  paymentCents: number
  principalCents: number
  startDate: string
  termMonths: number
}

/** `iso` + `n` calendar months, clamping to the target month's last day. */
function addMonthsClamped(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const targetMonthStart = Date.UTC(
    (y ?? 0) + Math.floor(((m ?? 1) - 1 + n) / 12),
    ((m ?? 1) - 1 + n) % 12,
    1
  )
  const t = new Date(targetMonthStart)
  const lastDay = new Date(
    Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)
  ).getUTCDate()
  t.setUTCDate(Math.min(d ?? 1, lastDay))
  return t.toISOString().slice(0, 10)
}

/**
 * Full reference amortization schedule (one row per month) from `startDate`
 * through `termMonths` or until the balance reaches 0, whichever is first.
 */
export function amortizationSchedule(debt: AmortizableDebt): AmortizationRow[] {
  const monthlyRate = debt.interestRatePct / 100 / 12
  const rows: AmortizationRow[] = []
  let balance = debt.principalCents
  for (let month = 1; month <= debt.termMonths && balance > 0; month++) {
    const interestCents = Math.round(balance * monthlyRate)
    const principalCents = Math.min(
      Math.max(debt.paymentCents - interestCents, 0),
      balance
    )
    balance -= principalCents
    rows.push({
      balanceCents: balance,
      interestCents,
      month,
      paymentDate: addMonthsClamped(debt.startDate, month),
      principalCents,
    })
  }
  return rows
}

/** Reference remaining balance at `asOfIso` per the textbook schedule. */
export function projectedBalanceCents(
  debt: AmortizableDebt,
  asOfIso: string
): number {
  const schedule = amortizationSchedule(debt)
  let balance = debt.principalCents
  for (const row of schedule) {
    if (row.paymentDate > asOfIso) {
      break
    }
    balance = row.balanceCents
  }
  return balance
}

/** First scheduled payment date on/after `asOfIso`, or null once paid off. */
export function nextPaymentDate(
  debt: AmortizableDebt,
  asOfIso: string
): string | null {
  const schedule = amortizationSchedule(debt)
  const next = schedule.find((row) => row.paymentDate >= asOfIso)
  return next?.paymentDate ?? null
}

/** Projected date the balance reaches 0, or null if it never does within `termMonths`. */
export function payoffDate(debt: AmortizableDebt): string | null {
  const schedule = amortizationSchedule(debt)
  const last = schedule.at(-1)
  return last && last.balanceCents === 0 ? last.paymentDate : null
}

/**
 * Roll a set of debts up into one totals row per currency, from each debt's
 * real `outstandingCents`. Paid-off debts are excluded.
 */
export function aggregateDebts(debts: DebtSnapshot[]): CurrencyDebtTotals[] {
  const byCurrency = new Map<string, CurrencyDebtTotals>()
  for (const d of debts) {
    if (d.status === 'paid_off') {
      continue
    }
    let totals = byCurrency.get(d.currency)
    if (!totals) {
      totals = {
        currency: d.currency,
        debtCount: 0,
        outstandingByType: {},
        totalOutstandingCents: 0,
      }
      byCurrency.set(d.currency, totals)
    }
    totals.totalOutstandingCents += d.outstandingCents
    totals.debtCount += 1
    totals.outstandingByType[d.type] =
      (totals.outstandingByType[d.type] ?? 0) + d.outstandingCents
  }
  return [...byCurrency.values()]
}
