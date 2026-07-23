import { computeHolding, type HoldingTxn } from './holdings'
import { valueHolding } from './valuation'

/**
 * Pure core of the refresh job (Inversiones A5): investment_transactions +
 * fresh quotes → `holdings` upsert rows. Groups that fail domain invariants
 * (oversell, mixed currency — possible after manual edits) are skipped and
 * reported, never silently dropped.
 */

export interface RebuildTxn extends HoldingTxn {
  assetId: string
  portfolioId: string
  userId: string
}

export interface QuoteForRebuild {
  currency: string
  priceCents: number
}

export interface HoldingUpsertRow {
  asset_id: string
  avg_cost_cents: number
  current_price_cents: number | null
  current_value_cents: number | null
  dividends_cents: number
  invested_cents: number
  portfolio_id: string
  quantity: number
  realized_pl_cents: number
  unrealized_pl_cents: number | null
  unrealized_pl_pct: number | null
  user_id: string
}

export function buildHoldingRows(
  txns: RebuildTxn[],
  quotes: ReadonlyMap<string, QuoteForRebuild>
): { rows: HoldingUpsertRow[]; skipped: string[] } {
  const groups = new Map<string, RebuildTxn[]>()
  for (const txn of txns) {
    const key = `${txn.portfolioId}:${txn.assetId}`
    const group = groups.get(key)
    if (group) {
      group.push(txn)
    } else {
      groups.set(key, [txn])
    }
  }

  const rows: HoldingUpsertRow[] = []
  const skipped: string[] = []
  for (const [key, group] of groups) {
    const first = group[0]
    if (!first) {
      continue
    }
    try {
      const h = computeHolding(group)
      const quote = quotes.get(first.assetId)
      // A quote in a different currency than the transaction log can't be
      // applied to this position; treat as unpriced rather than mixing.
      const priceCents =
        quote && quote.currency === first.currency ? quote.priceCents : null
      const v = valueHolding(h, priceCents)
      rows.push({
        asset_id: first.assetId,
        avg_cost_cents: h.avgCostCents,
        current_price_cents: priceCents,
        current_value_cents: v.currentValueCents,
        dividends_cents: 0, // Phase C fills this
        invested_cents: h.investedCents,
        portfolio_id: first.portfolioId,
        quantity: h.quantity,
        realized_pl_cents: h.realizedPlCents,
        unrealized_pl_cents: v.unrealizedPlCents,
        unrealized_pl_pct: v.unrealizedPlPct,
        user_id: first.userId,
      })
    } catch {
      skipped.push(key)
    }
  }
  return { rows, skipped }
}
