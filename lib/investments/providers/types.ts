import type { AssetType, QuoteType } from '@/lib/domain/investments/types'

/**
 * Provider-agnostic market-data shapes (Inversiones A3). Everything crossing
 * this boundary is already validated and cents-based; raw provider payloads
 * never leak past the clients. History/dividends are deliberately absent —
 * Finnhub's free tier no longer serves them (Phases C/D pick a source).
 */

export interface Quote {
  currency: string // ISO 4217 — Finnhub /quote carries none; inherited from the asset
  fetchedAt: string // ISO timestamp
  priceCents: number // integer, converted at the boundary
  quoteType: QuoteType // A3 emits 'live' only; A5 downgrades on staleness
}

export interface SymbolResult {
  assetType: AssetType
  coingeckoId: string | null // set for crypto results
  currency: string | null // Finnhub /search returns neither currency…
  exchange: string | null // …nor exchange — enrich via getFinnhubStockProfile
  isin: string | null
  name: string
  ticker: string
}

/** /stock/profile2 subset used by the A4 asset upsert. */
export interface AssetProfile {
  currency: string | null
  exchange: string | null
  isin: string | null
  name: string
  raw: Record<string, unknown> // stored into assets.provider_meta
  ticker: string
}

/** The asset fields quoting needs (a projection of an `assets` row). */
export interface QuoteTarget {
  coingeckoId: string | null
  currency: string // asset's native currency
  ticker: string | null
  type: AssetType
}

export interface PriceProvider {
  getQuote(target: QuoteTarget): Promise<Quote>
  searchSymbol(query: string): Promise<SymbolResult[]>
}

export type ProviderName = 'finnhub' | 'coingecko' | 'frankfurter' | 'fmp'
export type ProviderErrorKind =
  | 'http'
  | 'malformed'
  | 'not_found'
  | 'missing_key'

export class ProviderError extends Error {
  constructor(
    readonly provider: ProviderName,
    readonly kind: ProviderErrorKind,
    readonly status?: number
  ) {
    super(`${provider}: ${kind}${status === undefined ? '' : ` (${status})`}`)
    this.name = 'ProviderError'
  }
}
