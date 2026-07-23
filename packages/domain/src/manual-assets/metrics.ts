/**
 * Pure manual-assets portfolio math. Values are manual snapshots — there is no
 * price feed, cost basis, or income tracking here (unlike Real Estate /
 * Investments); this module only rolls current values up per currency.
 */

export interface ManualAssetSnapshot {
  currency: string
  currentValueCents: number
  isClosed: boolean
}

export interface CurrencyTotals {
  assetCount: number
  currency: string
  valueCents: number
}

/**
 * Roll a set of manual assets up into one totals row per currency. Closed
 * (sold/redeemed) assets drop out of value and the asset count.
 */
export function aggregatePortfolio(
  assets: ManualAssetSnapshot[]
): CurrencyTotals[] {
  const byCurrency = new Map<string, CurrencyTotals>()
  for (const asset of assets) {
    if (asset.isClosed) {
      continue
    }
    let totals = byCurrency.get(asset.currency)
    if (!totals) {
      totals = { assetCount: 0, currency: asset.currency, valueCents: 0 }
      byCurrency.set(asset.currency, totals)
    }
    totals.valueCents += asset.currentValueCents
    totals.assetCount += 1
  }
  return [...byCurrency.values()]
}
