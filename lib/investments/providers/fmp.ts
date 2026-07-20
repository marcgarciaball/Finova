import { z } from 'zod'
import { ProviderError } from './types'

/**
 * Financial Modeling Prep client (Inversiones Phase C/D) — dividend history
 * and daily closes, the roles Finnhub's free tier can no longer fill. Uses
 * the current `/stable` API: new API keys get 403 "legacy endpoint" on the
 * old `/api/v3` routes. Key from `opts.apiKey ?? process.env.FMP_API_KEY`
 * (free tier ~250 req/day, US-listed symbols). Amounts are per share in the
 * asset's trading currency (FMP doesn't state currency; the caller
 * attributes the asset's own).
 */

const BASE_URL = 'https://financialmodelingprep.com/stable'

export interface FmpOpts {
  apiKey?: string
  fetchImpl?: typeof fetch
}

async function getJson(path: string, opts: FmpOpts): Promise<unknown> {
  const key = opts.apiKey ?? process.env.FMP_API_KEY
  if (!key) {
    throw new ProviderError('fmp', 'missing_key')
  }
  const fetchImpl = opts.fetchImpl ?? fetch
  const res = await fetchImpl(`${BASE_URL}${path}&apikey=${key}`)
  if (!res.ok) {
    throw new ProviderError('fmp', 'http', res.status)
  }
  return res.json()
}

export interface FmpDividendEvent {
  amountPerShare: number // major units
  exDate: string
  payDate: string | null
}

const eventSchema = z.object({
  date: z.string(), // ex-dividend date
  dividend: z.number(),
  paymentDate: z.string().nullable().optional(),
})

export async function getFmpDividends(
  ticker: string,
  opts: FmpOpts = {}
): Promise<FmpDividendEvent[]> {
  const raw = await getJson(
    `/dividends?symbol=${encodeURIComponent(ticker)}`,
    opts
  )
  const parsed = z.array(z.unknown()).safeParse(raw)
  if (!parsed.success) {
    throw new ProviderError('fmp', 'malformed')
  }
  const events: FmpDividendEvent[] = []
  for (const item of parsed.data) {
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

const priceItemSchema = z.object({ date: z.string(), price: z.number() })

/**
 * Daily closes (EOD "light" series), oldest first. `fromIso` is required —
 * without it the endpoint returns only a short recent window.
 */
export async function getFmpDailyPrices(
  ticker: string,
  fromIso: string,
  opts: FmpOpts = {}
): Promise<FmpDailyPrice[]> {
  const raw = await getJson(
    `/historical-price-eod/light?symbol=${encodeURIComponent(ticker)}&from=${fromIso}`,
    opts
  )
  const parsed = z.array(z.unknown()).safeParse(raw)
  if (!parsed.success) {
    throw new ProviderError('fmp', 'malformed')
  }
  const out: FmpDailyPrice[] = []
  for (const item of parsed.data) {
    const p = priceItemSchema.safeParse(item)
    if (!p.success) {
      continue
    }
    out.push({ closeCents: Math.round(p.data.price * 100), date: p.data.date })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}
