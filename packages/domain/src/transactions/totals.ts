import { convert, type Money, money } from '../money/money'
import { transactionType } from './filters'

/**
 * Income / expense / net totals over a set of transactions (P1-06, P1-07).
 *
 * Two rules drive everything here:
 *  - **Transfers are excluded.** A transfer just moves money between the user's
 *    own accounts; counting it would double-count or distort income/expense.
 *    `is_transfer` rows never contribute to any total (P1-06).
 *  - **Income vs. expense is the sign of the amount**, not the category — `+`
 *    inflow, `−` outflow (ADR-007). `income` is the sum of positive amounts,
 *    `expense` the sum of the absolute value of negative amounts (so it is a
 *    positive magnitude), and `net = income − expense`.
 *
 * Amounts can be in different currencies (P1-07): `summarizeByCurrency` keeps a
 * separate total per currency (never summing across them), and `summarizeInBase`
 * converts each row into a single reporting currency using a caller-supplied
 * rate table — the domain never fetches FX rates.
 */

export interface Totals {
  /** Sum of |negative| (outflow) amounts, in cents — a positive magnitude. */
  expense: number
  /** Sum of positive (inflow) amounts, in cents. */
  income: number
  /** `income − expense`, in cents (may be negative). */
  net: number
}

export interface MoneyTotals {
  expense: Money
  income: Money
  net: Money
}

export type TxLike = {
  amount_cents: number
  currency: string
  is_transfer: boolean
}

const EMPTY: Totals = { income: 0, expense: 0, net: 0 }

/** Fold one transaction's amount into a running {income, expense, net}. */
function accumulate(acc: Totals, amountCents: number): Totals {
  if (amountCents >= 0) {
    const income = acc.income + amountCents
    return { income, expense: acc.expense, net: income - acc.expense }
  }
  const expense = acc.expense + Math.abs(amountCents)
  return { income: acc.income, expense, net: acc.income - expense }
}

/** Non-transfer rows only. */
const spendable = (rows: TxLike[]): TxLike[] =>
  rows.filter((r) => !r.is_transfer)

/**
 * Totals grouped by the transaction's own currency. Use when the user holds
 * multiple currencies and you want each reported in its native unit, with no
 * exchange-rate assumptions.
 */
export function summarizeByCurrency(rows: TxLike[]): Record<string, Totals> {
  const out: Record<string, Totals> = {}
  for (const row of spendable(rows)) {
    const current = out[row.currency] ?? EMPTY
    out[row.currency] = accumulate(current, row.amount_cents)
  }
  return out
}

/**
 * Totals converted into a single `base` currency. `rates` maps a currency code
 * to its value in one unit of `base` (e.g. `{ USD: 0.92 }` means 1 USD = 0.92
 * EUR when base is EUR); the base currency itself is implicitly rate 1. A row
 * in a currency missing from `rates` (and not the base) throws, so callers
 * surface "missing rate" rather than silently under-counting.
 */
export function summarizeInBase(
  rows: TxLike[],
  base: string,
  rates: Record<string, number> = {}
): MoneyTotals {
  let totals = EMPTY
  for (const row of spendable(rows)) {
    let cents: number
    if (row.currency === base) {
      cents = row.amount_cents
    } else {
      const rate = rates[row.currency]
      if (rate === undefined) {
        throw new Error(`missing exchange rate for ${row.currency}→${base}`)
      }
      cents = convert(money(row.amount_cents, row.currency), base, rate).amount
    }
    totals = accumulate(totals, cents)
  }
  return {
    income: money(totals.income, base),
    expense: money(totals.expense, base),
    net: money(totals.net, base),
  }
}

/** True when every spendable row is already in `base` (no FX needed). */
export function isSingleCurrency(rows: TxLike[], base: string): boolean {
  return spendable(rows).every((r) => r.currency === base)
}

// Re-export so callers can classify a row without reaching into filters.
export { transactionType }
