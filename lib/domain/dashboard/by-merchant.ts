/**
 * Spending-by-merchant aggregation. Pure and deterministic — the mirror of
 * `spendingByCategory` along the merchant axis: "which specific merchants
 * (transaction descriptions) am I spending the most at?" Same rules as the
 * category core: expense-only (negative `amount_cents`), transfers excluded,
 * kept per currency. The merchant key is the raw `description`, trimmed —
 * no fuzzy normalization, so "Carrefour Paris" and "Carrefour Lyon" are
 * distinct rows (a caller wanting fuzzy grouping does it upstream).
 */

export type MerchantTxn = {
  amount_cents: number
  currency: string
  description: string
  is_transfer: boolean
}

export interface MerchantSpend {
  /** Number of expense transactions at this merchant. */
  count: number
  merchant: string
  /** Fraction of the currency's total spending (0..1). */
  share: number
  /** Positive magnitude of outflows, in cents. */
  total: number
}

export function spendingByMerchant(
  txns: MerchantTxn[]
): Record<string, MerchantSpend[]> {
  const byCurrency = new Map<
    string,
    Map<string, { total: number; count: number }>
  >()

  for (const txn of txns) {
    if (txn.is_transfer || txn.amount_cents >= 0) continue
    const merchant = txn.description.trim()
    if (merchant === '') continue
    let groups = byCurrency.get(txn.currency)
    if (!groups) {
      groups = new Map()
      byCurrency.set(txn.currency, groups)
    }
    const magnitude = Math.abs(txn.amount_cents)
    const entry = groups.get(merchant)
    if (entry) {
      entry.total += magnitude
      entry.count += 1
    } else {
      groups.set(merchant, { total: magnitude, count: 1 })
    }
  }

  const out: Record<string, MerchantSpend[]> = {}
  for (const [currency, groups] of byCurrency) {
    const entries = [...groups.entries()]
    const grand = entries.reduce((sum, [, e]) => sum + e.total, 0)
    out[currency] = entries
      .map(([merchant, e]) => ({
        merchant,
        total: e.total,
        count: e.count,
        share: grand === 0 ? 0 : e.total / grand,
      }))
      .sort((a, b) => b.total - a.total || b.count - a.count)
  }
  return out
}
