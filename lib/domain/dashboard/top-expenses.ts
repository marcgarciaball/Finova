/**
 * Top-N single expenses (biggest individual outflows), per currency. Pure —
 * the list form of `keyStats().biggestExpense`, which only keeps the single
 * largest. Expense-only (negative `amount_cents`), transfers excluded.
 */

export type ExpenseTxn = {
  amount_cents: number
  currency: string
  description: string
  id: string
  is_transfer: boolean
  occurred_at: string
}

export interface TopExpense {
  amountCents: number
  description: string
  id: string
  occurredAt: string
}

export function topExpenses(
  txns: ExpenseTxn[],
  limit: number
): Record<string, TopExpense[]> {
  const byCurrency = new Map<string, TopExpense[]>()

  for (const txn of txns) {
    if (txn.is_transfer || txn.amount_cents >= 0) continue
    const list = byCurrency.get(txn.currency) ?? []
    list.push({
      id: txn.id,
      amountCents: Math.abs(txn.amount_cents),
      description: txn.description,
      occurredAt: txn.occurred_at,
    })
    byCurrency.set(txn.currency, list)
  }

  const out: Record<string, TopExpense[]> = {}
  for (const [currency, list] of byCurrency) {
    out[currency] = list
      .sort((a, b) => b.amountCents - a.amountCents)
      .slice(0, limit)
  }
  return out
}
