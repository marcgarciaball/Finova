import { z } from 'zod'
import { ProviderError } from './types'

/**
 * Financial Modeling Prep client (Inversiones Phase C) — dividend history,
 * the role Finnhub's free tier can no longer fill. Key from `opts.apiKey ??
 * process.env.FMP_API_KEY` (free tier ~250 req/day). Amounts are per share
 * in the asset's trading currency (FMP doesn't state currency; the caller
 * attributes the asset's own).
 */

const BASE_URL = 'https://financialmodelingprep.com/api/v3'

export interface FmpOpts {
  apiKey?: string
  fetchImpl?: typeof fetch
}

export interface FmpDividendEvent {
  amountPerShare: number // major units
  exDate: string
  payDate: string | null
}

const responseSchema = z.object({ historical: z.array(z.unknown()).optional() })
const eventSchema = z.object({
  date: z.string(),
  dividend: z.number(),
  paymentDate: z.string().optional(),
})

export async function getFmpDividends(
  ticker: string,
  opts: FmpOpts = {}
): Promise<FmpDividendEvent[]> {
  const key = opts.apiKey ?? process.env.FMP_API_KEY
  if (!key) {
    throw new ProviderError('fmp', 'missing_key')
  }
  const fetchImpl = opts.fetchImpl ?? fetch
  const res = await fetchImpl(
    `${BASE_URL}/historical-price-full/stock_dividend/${encodeURIComponent(ticker)}?apikey=${key}`
  )
  if (!res.ok) {
    throw new ProviderError('fmp', 'http', res.status)
  }
  const parsed = responseSchema.safeParse(await res.json())
  if (!parsed.success) {
    throw new ProviderError('fmp', 'malformed')
  }
  const events: FmpDividendEvent[] = []
  for (const item of parsed.data.historical ?? []) {
    const p = eventSchema.safeParse(item)
    if (!p.success || p.data.dividend <= 0) {
      continue // drop malformed/zero rows, keep the usable history
    }
    events.push({
      amountPerShare: p.data.dividend,
      exDate: p.data.date,
      payDate: p.data.paymentDate ? p.data.paymentDate : null,
    })
  }
  return events
}

export interface FmpDailyPrice {
  closeCents: number
  date: string
}

const pricesSchema = z.object({ historical: z.array(z.unknown()).optional() })
const priceItemSchema = z.object({ close: z.number(), date: z.string() })

/** Daily closes (EOD, ~5y on the free tier), oldest first. */
export async function getFmpDailyPrices(
  ticker: string,
  opts: FmpOpts = {}
): Promise<FmpDailyPrice[]> {
  const key = opts.apiKey ?? process.env.FMP_API_KEY
  if (!key) {
    throw new ProviderError('fmp', 'missing_key')
  }
  const fetchImpl = opts.fetchImpl ?? fetch
  const res = await fetchImpl(
    `${BASE_URL}/historical-price-full/${encodeURIComponent(ticker)}?serietype=line&apikey=${key}`
  )
  if (!res.ok) {
    throw new ProviderError('fmp', 'http', res.status)
  }
  const parsed = pricesSchema.safeParse(await res.json())
  if (!parsed.success) {
    throw new ProviderError('fmp', 'malformed')
  }
  const out: FmpDailyPrice[] = []
  for (const item of parsed.data.historical ?? []) {
    const p = priceItemSchema.safeParse(item)
    if (!p.success) {
      continue
    }
    out.push({ closeCents: Math.round(p.data.close * 100), date: p.data.date })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}
