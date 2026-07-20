/**
 * Dashboard summary core (P4-01): account balances, per-currency totals, and
 * the savings rate. Pure and deterministic — no I/O, no React, no FX fetching.
 *
 * Net cash flow (income/expense/net) is NOT re-derived here; the dashboard
 * consumes the P1-06 `summarizeByCurrency` totals directly. This module covers
 * the two figures totals can't give you:
 *
 *  - **Balances** — opening balance plus the *signed* sum of an account's
 *    transactions. Transfers ARE included (they move money through the account,
 *    so they change its balance) — the deliberate inverse of the totals module,
 *    which excludes transfers to avoid double-counting income/expense.
 *  - **Savings rate** — `net / income`, the fraction of income kept.
 *
 * Balances never sum across currencies (mirroring `summarizeInBase`): an
 * account has one currency, and a foreign-currency transaction would need an FX
 * rate the domain refuses to invent, so it is excluded and counted instead.
 */

export type BalanceAccount = {
  id: string
  currency: string
  /** Opening balance in minor units (cents, ADR-007). */
  opening_balance: number
}

export type BalanceTxn = {
  account_id: string
  /** Signed minor units — `+` inflow, `−` outflow. */
  amount_cents: number
  currency: string
}

export interface AccountBalance {
  accountId: string
  /** opening_balance + signed sum of same-currency transactions, in cents. */
  balance: number
  currency: string
  /** Transactions on this account skipped because currency ≠ account currency. */
  foreignCount: number
}

/**
 * Current balance for each account. Transfers are included; a transaction in a
 * currency other than its account's is excluded from the sum and counted in
 * `foreignCount`. Output order mirrors the input `accounts`.
 */
export function accountBalances(
  accounts: BalanceAccount[],
  txns: BalanceTxn[]
): AccountBalance[] {
  // Group transactions by account once so this is O(accounts + txns).
  const byAccount = new Map<string, BalanceTxn[]>()
  for (const txn of txns) {
    const list = byAccount.get(txn.account_id)
    if (list) list.push(txn)
    else byAccount.set(txn.account_id, [txn])
  }

  return accounts.map((account) => {
    let balance = account.opening_balance
    let foreignCount = 0
    for (const txn of byAccount.get(account.id) ?? []) {
      if (txn.currency === account.currency) {
        balance += txn.amount_cents
      } else {
        foreignCount += 1
      }
    }
    return {
      accountId: account.id,
      currency: account.currency,
      balance,
      foreignCount,
    }
  })
}

/**
 * Sum of account balances grouped by currency. Never merges distinct currencies
 * (no FX); an empty input yields `{}`.
 */
export function totalBalanceByCurrency(
  balances: AccountBalance[]
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const b of balances) {
    out[b.currency] = (out[b.currency] ?? 0) + b.balance
  }
  return out
}

/**
 * The fraction of income kept: `(income − expense) / income`. Returns `null`
 * when income ≤ 0 (no income ⇒ no rate to report — not 0, not Infinity). When
 * expenses exceed income the rate is negative (overspending), reported as-is.
 */
export function savingsRate(totals: {
  income: number
  expense: number
}): number | null {
  if (totals.income <= 0) return null
  return (totals.income - totals.expense) / totals.income
}
