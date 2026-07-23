import type { AssetType } from '@finova/domain/investments/types'
import { z } from 'zod'
import {
  type AssetProfile,
  ProviderError,
  type Quote,
  type QuoteTarget,
  type SymbolResult,
} from './types'

/**
 * Finnhub client (Inversiones A3) — stocks/ETFs/funds. Free-tier endpoints
 * only: /quote, /search, /stock/profile2 (candles and dividends went paid in
 * 2023 and are deliberately not wrapped). /quote returns floats in major
 * units and NO currency — the quote inherits the asset's stored currency.
 */

const BASE_URL = 'https://finnhub.io/api/v1'

export interface FinnhubOpts {
  apiKey?: string
  fetchImpl?: typeof fetch
}

function resolveKey(opts: FinnhubOpts): string {
  const key = opts.apiKey ?? process.env.FINNHUB_API_KEY
  if (!key) {
    throw new ProviderError('finnhub', 'missing_key')
  }
  return key
}

async function getJson(path: string, opts: FinnhubOpts): Promise<unknown> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetchImpl(
    `${BASE_URL}${path}${sep}token=${resolveKey(opts)}`
  )
  if (!res.ok) {
    throw new ProviderError('finnhub', 'http', res.status)
  }
  return res.json()
}

const quoteSchema = z.object({ c: z.number(), t: z.number() })

export async function getFinnhubQuote(
  target: QuoteTarget,
  opts: FinnhubOpts = {}
): Promise<Quote> {
  if (!target.ticker) {
    throw new ProviderError('finnhub', 'malformed')
  }
  const raw = await getJson(
    `/quote?symbol=${encodeURIComponent(target.ticker)}`,
    opts
  )
  const parsed = quoteSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ProviderError('finnhub', 'malformed')
  }
  const { c, t } = parsed.data
  if (c === 0 && t === 0) {
    throw new ProviderError('finnhub', 'not_found')
  }
  return {
    currency: target.currency,
    fetchedAt: new Date(t * 1000).toISOString(),
    priceCents: Math.round(c * 100),
    provider: 'finnhub',
    quoteType: 'live',
  }
}

const searchSchema = z.object({ result: z.array(z.unknown()) })
const searchItemSchema = z.object({
  description: z.string(),
  symbol: z.string(),
  type: z.string().default(''),
})

function mapFinnhubType(type: string): AssetType {
  const v = type.toLowerCase()
  if (v === 'etp' || v.includes('etf')) {
    return 'etf'
  }
  if (v.includes('fund')) {
    return 'fund'
  }
  return 'stock'
}

export async function searchFinnhubSymbols(
  query: string,
  opts: FinnhubOpts = {}
): Promise<SymbolResult[]> {
  const raw = await getJson(`/search?q=${encodeURIComponent(query)}`, opts)
  const parsed = searchSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ProviderError('finnhub', 'malformed')
  }
  const results: SymbolResult[] = []
  for (const item of parsed.data.result) {
    const p = searchItemSchema.safeParse(item)
    if (!p.success) {
      continue // drop malformed items, keep the rest of the search usable
    }
    results.push({
      assetType: mapFinnhubType(p.data.type),
      coingeckoId: null,
      currency: null, // /search carries neither currency nor exchange
      exchange: null,
      isin: null,
      name: p.data.description,
      ticker: p.data.symbol,
    })
  }
  return results
}

const profileSchema = z.object({
  currency: z.string().optional(),
  exchange: z.string().optional(),
  isin: z.string().optional(),
  name: z.string().optional(),
  ticker: z.string().optional(),
})

export async function getFinnhubStockProfile(
  ticker: string,
  opts: FinnhubOpts = {}
): Promise<AssetProfile> {
  const raw = await getJson(
    `/stock/profile2?symbol=${encodeURIComponent(ticker)}`,
    opts
  )
  if (typeof raw !== 'object' || raw === null) {
    throw new ProviderError('finnhub', 'malformed')
  }
  if (Object.keys(raw).length === 0) {
    throw new ProviderError('finnhub', 'not_found') // unknown/uncovered symbol
  }
  const parsed = profileSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ProviderError('finnhub', 'malformed')
  }
  return {
    currency: parsed.data.currency ?? null,
    exchange: parsed.data.exchange ?? null,
    isin: parsed.data.isin ?? null,
    name: parsed.data.name ?? ticker,
    raw: raw as Record<string, unknown>,
    ticker: parsed.data.ticker ?? ticker,
  }
}
