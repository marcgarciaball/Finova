/**
 * Daily portfolio-value series (Inversiones Phase D). Pure. For each day from
 * the first transaction to `todayIso`, value = Σ over assets of
 * quantity-held(day) × last-known-close(day), converted to the base currency
 * at that day's last-known FX rate. Assets contribute only once they have a
 * price; days before the first known price are skipped for that asset.
 */

export interface SeriesTxn {
  assetId: string
  currency: string // asset native currency
  quantity: number
  tradedAt: string
  type: 'buy' | 'sell'
}

export interface SeriesPrice {
  assetId: string
  closeCents: number
  date: string
}

export interface SeriesFxRate {
  date: string
  fromCcy: string
  rate: number
  toCcy: string
}

export interface SeriesPoint {
  date: string
  valueCents: number // base currency
}

const QTY_SCALE = 1e8
const DAY_MS = 86_400_000

function eachDay(fromIso: string, toIso: string): string[] {
  const out: string[] = []
  const end = new Date(`${toIso}T00:00:00Z`).getTime()
  for (
    let ts = new Date(`${fromIso}T00:00:00Z`).getTime();
    ts <= end;
    ts += DAY_MS
  ) {
    out.push(new Date(ts).toISOString().slice(0, 10))
  }
  return out
}

export function dailyValueSeries(
  txns: SeriesTxn[],
  prices: SeriesPrice[],
  fxRates: SeriesFxRate[],
  baseCurrency: string,
  todayIso: string
): SeriesPoint[] {
  if (txns.length === 0) {
    return []
  }
  const firstDate = txns.reduce(
    (min, t) => (t.tradedAt < min ? t.tradedAt : min),
    txns[0]?.tradedAt ?? todayIso
  )

  // Per-asset quantity deltas by date (integer 1e-8 units).
  const deltasByAsset = new Map<string, Map<string, number>>()
  const currencyByAsset = new Map<string, string>()
  for (const t of txns) {
    currencyByAsset.set(t.assetId, t.currency)
    const deltas = deltasByAsset.get(t.assetId) ?? new Map<string, number>()
    const units = Math.round(t.quantity * QTY_SCALE)
    deltas.set(
      t.tradedAt,
      (deltas.get(t.tradedAt) ?? 0) + (t.type === 'buy' ? units : -units)
    )
    deltasByAsset.set(t.assetId, deltas)
  }

  // Per-asset close by date; per-pair rate by date (for carry-forward walks).
  const priceByAssetDate = new Map<string, number>()
  for (const p of prices) {
    priceByAssetDate.set(`${p.assetId}:${p.date}`, p.closeCents)
  }
  const rateByPairDate = new Map<string, number>()
  for (const r of fxRates) {
    rateByPairDate.set(`${r.fromCcy}->${r.toCcy}:${r.date}`, r.rate)
  }

  const assetIds = [...deltasByAsset.keys()]
  const heldUnits = new Map<string, number>(assetIds.map((id) => [id, 0]))
  const lastClose = new Map<string, number>()
  const lastRate = new Map<string, number>() // keyed "FROM->TO"

  const out: SeriesPoint[] = []
  for (const date of eachDay(firstDate, todayIso)) {
    let valueCents = 0
    let anyPriced = false
    for (const assetId of assetIds) {
      const delta = deltasByAsset.get(assetId)?.get(date)
      if (delta !== undefined) {
        heldUnits.set(assetId, (heldUnits.get(assetId) ?? 0) + delta)
      }
      const close = priceByAssetDate.get(`${assetId}:${date}`)
      if (close !== undefined) {
        lastClose.set(assetId, close)
      }
      const units = heldUnits.get(assetId) ?? 0
      const price = lastClose.get(assetId)
      if (units <= 0 || price === undefined) {
        continue
      }
      const ccy = currencyByAsset.get(assetId) ?? baseCurrency
      let native = (units / QTY_SCALE) * price
      if (ccy !== baseCurrency) {
        const pair = `${ccy}->${baseCurrency}`
        const rate = rateByPairDate.get(`${pair}:${date}`)
        if (rate !== undefined) {
          lastRate.set(pair, rate)
        }
        const effective = lastRate.get(pair)
        if (effective === undefined) {
          continue // no rate known yet — skip rather than fake it
        }
        native *= effective
      }
      valueCents += native
      anyPriced = true
    }
    if (anyPriced) {
      out.push({ date, valueCents: Math.round(valueCents) })
    }
  }
  return out
}
