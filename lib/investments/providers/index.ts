import type { AssetType } from '@finova/domain/investments/types'
import { getCoinGeckoQuote, searchCoinGeckoSymbols } from './coingecko'

export { getCoinGeckoDailyPrices } from './coingecko'

import { getFinnhubQuote, searchFinnhubSymbols } from './finnhub'
import {
  ProviderError,
  type Quote,
  type QuoteTarget,
  type SymbolResult,
} from './types'
import { getYahooQuote } from './yahoo'

export { getYahooDividends, type YahooDividendEvent } from './yahoo'

/**
 * Provider-agnostic entry point (Inversiones A3): stock | etf | fund →
 * Finnhub; crypto → CoinGecko. Fund coverage on Finnhub's free tier is thin —
 * a `not_found` ProviderError surfaces that honestly rather than guessing.
 *
 * Finnhub's free tier also rejects non-US exchanges outright (403), which
 * matters for UCITS ETFs listed on LSE etc. (Inversiones A5): any Finnhub
 * failure falls back to Yahoo's keyless chart endpoint, which covers those
 * tickers under the same symbol (e.g. `VUSD.L`).
 */

export interface RouterOpts {
  apiKey?: string
  fetchImpl?: typeof fetch
}

export async function getQuote(
  target: QuoteTarget,
  opts: RouterOpts = {}
): Promise<Quote> {
  if (target.type === 'crypto') {
    return getCoinGeckoQuote(target, opts)
  }
  try {
    return await getFinnhubQuote(target, opts)
  } catch (e) {
    if (!(e instanceof ProviderError)) {
      throw e
    }
    return getYahooQuote(target, opts)
  }
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
