import type { AssetType } from '@finova/domain/investments/types'
import { getCoinGeckoQuote, searchCoinGeckoSymbols } from './coingecko'

export { getCoinGeckoDailyPrices } from './coingecko'

import { getFinnhubQuote, searchFinnhubSymbols } from './finnhub'
import type { Quote, QuoteTarget, SymbolResult } from './types'

/**
 * Provider-agnostic entry point (Inversiones A3): stock | etf | fund →
 * Finnhub; crypto → CoinGecko. Fund coverage on Finnhub's free tier is thin —
 * a `not_found` ProviderError surfaces that honestly rather than guessing.
 */

export interface RouterOpts {
  apiKey?: string
  fetchImpl?: typeof fetch
}

export function getQuote(
  target: QuoteTarget,
  opts: RouterOpts = {}
): Promise<Quote> {
  return target.type === 'crypto'
    ? getCoinGeckoQuote(target, opts)
    : getFinnhubQuote(target, opts)
}

export function searchSymbol(
  query: string,
  assetType: AssetType,
  opts: RouterOpts = {}
): Promise<SymbolResult[]> {
  return assetType === 'crypto'
    ? searchCoinGeckoSymbols(query, opts)
    : searchFinnhubSymbols(query, opts)
}

export { getFinnhubStockProfile } from './finnhub'
export {
  type FmpDailyPrice,
  type FmpDividendEvent,
  getFmpDailyPrices,
  getFmpDividends,
} from './fmp'
export {
  type DailyFxRates,
  type FxRateRowInput,
  fetchDailyRates,
  fetchRateHistory,
} from './fx'
export * from './types'
