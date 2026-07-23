import { z } from 'zod'
import { ProviderError, type Quote, type QuoteTarget } from './types'

/**
 * Yahoo Finance fallback client (Inversiones A5) — keyless, unofficial chart
 * endpoint. Finnhub's free tier only serves US-listed quotes; international
 * exchanges (e.g. LSE `.L` tickers) return a 403/zero quote there. Yahoo
 * uses the same ticker suffixes already stored on the asset, so tickers
 * need no remapping. Unofficial API: no uptime/format guarantee.
 */

const BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart'

export interface YahooOpts {
  fetchImpl?: typeof fetch
}

const chartSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          meta: z.object({
            currency: z.string().optional(),
            regularMarketPrice: z.number(),
            regularMarketTime: z.number(),
          }),
        })
      )
      .nullable(),
  }),
})

export async function getYahooQuote(
  target: QuoteTarget,
  opts: YahooOpts = {}
): Promise<Quote> {
  if (!target.ticker) {
    throw new ProviderError('yahoo', 'malformed')
  }
  const fetchImpl = opts.fetchImpl ?? fetch
  const res = await fetchImpl(
    `${BASE_URL}/${encodeURIComponent(target.ticker)}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  )
  if (!res.ok) {
    throw new ProviderError('yahoo', 'http', res.status)
  }
  const parsed = chartSchema.safeParse(await res.json())
  if (!parsed.success) {
    throw new ProviderError('yahoo', 'malformed')
  }
  const result = parsed.data.chart.result?.[0]
  if (!result) {
    throw new ProviderError('yahoo', 'not_found')
  }
  return {
    currency: result.meta.currency ?? target.currency,
    fetchedAt: new Date(result.meta.regularMarketTime * 1000).toISOString(),
    priceCents: Math.round(result.meta.regularMarketPrice * 100),
    provider: 'yahoo',
    quoteType: 'live',
  }
}

export interface YahooDividendEvent {
  amountPerShare: number // major units, in the instrument's trading currency
  exDate: string
  payDate: string | null // Yahoo's chart events carry no separate pay date
}

const dividendsSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          events: z
            .object({
              dividends: z
                .record(
                  z.string(),
                  z.object({ amount: z.number(), date: z.number() })
                )
                .optional(),
            })
            .optional(),
        })
      )
      .nullable(),
  }),
})

/** Same fallback role as `getYahooQuote` — FMP's free tier is US-only too. */
export async function getYahooDividends(
  ticker: string,
  opts: YahooOpts = {}
): Promise<YahooDividendEvent[]> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const res = await fetchImpl(
    `${BASE_URL}/${encodeURIComponent(ticker)}?events=div&range=10y&interval=1mo`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  )
  if (!res.ok) {
    throw new ProviderError('yahoo', 'http', res.status)
  }
  const parsed = dividendsSchema.safeParse(await res.json())
  if (!parsed.success) {
    throw new ProviderError('yahoo', 'malformed')
  }
  const dividends = parsed.data.chart.result?.[0]?.events?.dividends ?? {}
  return Object.values(dividends)
    .map((d) => ({
      amountPerShare: d.amount,
      exDate: new Date(d.date * 1000).toISOString().slice(0, 10),
      payDate: null,
    }))
    .sort((a, b) => a.exDate.localeCompare(b.exDate))
}
