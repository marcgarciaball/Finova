import { z } from 'zod'
import {
  ProviderError,
  type Quote,
  type QuoteTarget,
  type SymbolResult,
} from './types'

/**
 * CoinGecko client (Inversiones A3) — crypto. Keyless free endpoints.
 * /simple/price quotes in the vs_currency we ask for, so the asset's stored
 * currency drives the request; `ids` accepts comma-separated values, which
 * A5 will use for batching.
 */

const BASE_URL = 'https://api.coingecko.com/api/v3'

export interface CoinGeckoOpts {
  fetchImpl?: typeof fetch
}

async function getJson(path: string, opts: CoinGeckoOpts): Promise<unknown> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const res = await fetchImpl(`${BASE_URL}${path}`)
  if (!res.ok) {
    throw new ProviderError('coingecko', 'http', res.status)
  }
  return res.json()
}

const priceSchema = z.record(z.string(), z.record(z.string(), z.number()))

export async function getCoinGeckoQuote(
  target: QuoteTarget,
  opts: CoinGeckoOpts = {}
): Promise<Quote> {
  if (!target.coingeckoId) {
    throw new ProviderError('coingecko', 'malformed')
  }
  const vs = target.currency.toLowerCase()
  const raw = await getJson(
    `/simple/price?ids=${encodeURIComponent(target.coingeckoId)}&vs_currencies=${vs}`,
    opts
  )
  const parsed = priceSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ProviderError('coingecko', 'malformed')
  }
  const price = parsed.data[target.coingeckoId]?.[vs]
  if (price === undefined) {
    throw new ProviderError('coingecko', 'not_found')
  }
  return {
    currency: target.currency,
    fetchedAt: new Date().toISOString(),
    priceCents: Math.round(price * 100),
    quoteType: 'live', // 24/7 market
  }
}

const searchSchema = z.object({ coins: z.array(z.unknown()) })
const coinSchema = z.object({
  id: z.string(),
  name: z.string(),
  symbol: z.string(),
})

export async function searchCoinGeckoSymbols(
  query: string,
  opts: CoinGeckoOpts = {}
): Promise<SymbolResult[]> {
  const raw = await getJson(`/search?query=${encodeURIComponent(query)}`, opts)
  const parsed = searchSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ProviderError('coingecko', 'malformed')
  }
  const results: SymbolResult[] = []
  for (const item of parsed.data.coins) {
    const p = coinSchema.safeParse(item)
    if (!p.success) {
      continue // drop malformed coins, keep the rest of the search usable
    }
    results.push({
      assetType: 'crypto',
      coingeckoId: p.data.id,
      currency: null,
      exchange: null,
      isin: null,
      name: p.data.name,
      ticker: p.data.symbol.toUpperCase(),
    })
  }
  return results
}

const chartSchema = z.object({
  prices: z.array(z.tuple([z.number(), z.number()])),
})

export interface CoinGeckoDailyPrice {
  closeCents: number
  date: string
}

/** Daily prices in `vsCurrency` for up to 365 days (free-tier cap). */
export async function getCoinGeckoDailyPrices(
  coingeckoId: string,
  vsCurrency: string,
  opts: CoinGeckoOpts = {}
): Promise<CoinGeckoDailyPrice[]> {
  const raw = await getJson(
    `/coins/${encodeURIComponent(coingeckoId)}/market_chart?vs_currency=${vsCurrency.toLowerCase()}&days=365`,
    opts
  )
  const parsed = chartSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ProviderError('coingecko', 'malformed')
  }
  const byDate = new Map<string, number>()
  for (const [ms, price] of parsed.data.prices) {
    byDate.set(new Date(ms).toISOString().slice(0, 10), Math.round(price * 100))
  }
  return [...byDate.entries()]
    .map(([date, closeCents]) => ({ closeCents, date }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
