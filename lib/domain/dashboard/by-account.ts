/**
 * Spending-across-accounts aggregation (UD-06). Pure and deterministic.
 *
 * The mirror of `spendingByCategory` (P4-02) along the account axis: it answers
 * "how does each account contribute to total spend?" "Spending" is expense —
 * the *negative* sign of `amount_cents` (ADR-007), reported as a positive
 * magnitude. Income never appears; transfers never appear (a transfer is not
 * spending). Kept per currency (the domain never sums across currencies).
 *
 * Id-only and i18n-free: the account name is resolved at render time.
 */

export type AccountTxn = {
  account_id: string
  /** Signed minor units — only negative (expense) rows contribute. */
  amount_cents: number
  currency: string
  is_transfer: boolean
}

export interface AccountSpend {
  accountId: string
  /** Number of expense transactions on this account. */
  count: number
  /** Fraction of the currency's total spending (0..1; 0 when total is 0). */
  share: number
  /** Positive magnitude of outflows on this account, in cents. */
  total: number
}

export function spendingByAccount(
  txns: AccountTxn[]
): Record<string, AccountSpend[]> {
  const byCurrency = new Map<
    string,
    Map<string, { accountId: string; total: number; count: number }>
  >()

  for (const txn of txns) {
    if (txn.is_transfer || txn.amount_cents >= 0) continue
    let groups = byCurrency.get(txn.currency)
    if (!groups) {
      groups = new Map()
      byCurrency.set(txn.currency, groups)
    }
    const entry = groups.get(txn.account_id)
    const magnitude = Math.abs(txn.amount_cents)
    if (entry) {
      entry.total += magnitude
      entry.count += 1
    } else {
      groups.set(txn.account_id, {
        accountId: txn.account_id,
        total: magnitude,
        count: 1,
      })
    }
  }

  const out: Record<string, AccountSpend[]> = {}
  for (const [currency, groups] of byCurrency) {
    const entries = [...groups.values()]
    const grand = entries.reduce((sum, e) => sum + e.total, 0)
    out[currency] = entries
      .map((e) => ({
        accountId: e.accountId,
        total: e.total,
        count: e.count,
        share: grand === 0 ? 0 : e.total / grand,
      }))
      .sort((a, b) => b.total - a.total || b.count - a.count)
  }
  return out
}
