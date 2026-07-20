import type { AssetType } from './types'

/**
 * Portfolio aggregation (Inversiones A2). Pure. The ONLY place cross-currency
 * sums happen: every holding converts to the base currency first (rounded
 * once per holding), then integer cents are summed. Unpriced holdings (no
 * cached quote yet) count toward invested but are excluded from value, P/L
 * and allocations — surfaced via `unpricedCount`, never silently.
 */

export type FxRateTable = ReadonlyMap<string, number>

export const fxKey = (from: string, to: string): string => `${from}->${to}`

export class MissingRateError extends Error {
  constructor(from: string, to: string) {
    super(`no FX rate for ${from}->${to}`)
    this.name = 'MissingRateError'
  }
}

export function convertCents(
  amountCents: number,
  from: string,
  to: string,
  rates: FxRateTable
): number {
  if (from === to) {
    return amountCents
  }
  const rate = rates.get(fxKey(from, to))
  if (rate === undefined) {
    throw new MissingRateError(from, to)
  }
  return Math.round(amountCents * rate)
}

export interface ValuedHolding {
  assetType: AssetType
  currency: string // asset's native currency
  currentValueCents: number | null
  investedCents: number
  unrealizedPlPct: number | null
}

export interface PortfolioTotals {
  allocationByCurrency: Record<string, number>
  allocationByType: Partial<Record<AssetType, number>>
  pricedInvestedCents: number
  totalInvestedCents: number
  totalPlCents: number
  totalPlPct: number | null
  totalValueCents: number
  unpricedCount: number
}

export function computePortfolioTotals(
  holdings: ValuedHolding[],
  baseCurrency: string,
  rates: FxRateTable
): PortfolioTotals {
  let totalInvestedCents = 0
  let pricedInvestedCents = 0
  let totalValueCents = 0
  let unpricedCount = 0
  const valueByType = new Map<AssetType, number>()
  const valueByCurrency = new Map<string, number>()

  for (const h of holdings) {
    const invested = convertCents(
      h.investedCents,
      h.currency,
      baseCurrency,
      rates
    )
    totalInvestedCents += invested
    if (h.currentValueCents === null) {
      unpricedCount += 1
      continue
    }
    const value = convertCents(
      h.currentValueCents,
      h.currency,
      baseCurrency,
      rates
    )
    pricedInvestedCents += invested
    totalValueCents += value
    valueByType.set(h.assetType, (valueByType.get(h.assetType) ?? 0) + value)
    valueByCurrency.set(
      h.currency,
      (valueByCurrency.get(h.currency) ?? 0) + value
    )
  }

  const totalPlCents = totalValueCents - pricedInvestedCents
  const allocationByType: Partial<Record<AssetType, number>> = {}
  const allocationByCurrency: Record<string, number> = {}
  if (totalValueCents > 0) {
    for (const [type, value] of valueByType) {
      allocationByType[type] = value / totalValueCents
    }
    for (const [ccy, value] of valueByCurrency) {
      allocationByCurrency[ccy] = value / totalValueCents
    }
  }

  return {
    allocationByCurrency,
    allocationByType,
    pricedInvestedCents,
    totalInvestedCents,
    totalPlCents,
    totalPlPct:
      pricedInvestedCents > 0
        ? (totalPlCents / pricedInvestedCents) * 100
        : null,
    totalValueCents,
    unpricedCount,
  }
}

export function topMovers(
  holdings: ValuedHolding[],
  n: number
): { losers: ValuedHolding[]; winners: ValuedHolding[] } {
  const priced = holdings.filter((h) => h.unrealizedPlPct !== null)
  const byPctDesc = [...priced].sort(
    (a, b) => (b.unrealizedPlPct ?? 0) - (a.unrealizedPlPct ?? 0)
  )
  return {
    winners: byPctDesc.slice(0, n),
    losers: [...byPctDesc].reverse().slice(0, n),
  }
}
