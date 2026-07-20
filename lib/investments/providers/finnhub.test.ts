import { describe, expect, it, vi } from 'vitest'
import {
  getFinnhubQuote,
  getFinnhubStockProfile,
  searchFinnhubSymbols,
} from './finnhub'
import { ProviderError, type QuoteTarget } from './types'

const jsonRes = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response

const stub = (body: unknown, status = 200) =>
  vi.fn(async () => jsonRes(body, status)) as unknown as typeof fetch

const target: QuoteTarget = {
  coingeckoId: null,
  currency: 'USD',
  ticker: 'AAPL',
  type: 'stock',
}

const opts = (fetchImpl: typeof fetch) => ({ apiKey: 'k', fetchImpl })

describe('getFinnhubQuote', () => {
  it('converts the float quote to integer cents', async () => {
    const fetchImpl = stub({ c: 261.74, t: 1750000000 })
    const q = await getFinnhubQuote(target, opts(fetchImpl))
    expect(q.priceCents).toBe(26174)
    expect(q.currency).toBe('USD') // inherited from the target
    expect(q.quoteType).toBe('live')
    expect(q.fetchedAt).toBe(new Date(1750000000 * 1000).toISOString())
  })

  it('requests the symbol with the key', async () => {
    const fetchImpl = stub({ c: 1, t: 1 })
    await getFinnhubQuote(target, opts(fetchImpl))
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as string
    expect(url).toContain('/quote?symbol=AAPL')
    expect(url).toContain('token=k')
  })

  it('maps the zero quote to not_found', async () => {
    const fetchImpl = stub({ c: 0, d: null, t: 0 })
    await expect(
      getFinnhubQuote(target, opts(fetchImpl))
    ).rejects.toMatchObject({ kind: 'not_found', provider: 'finnhub' })
  })

  it('maps HTTP errors', async () => {
    const fetchImpl = stub({}, 429)
    await expect(
      getFinnhubQuote(target, opts(fetchImpl))
    ).rejects.toMatchObject({ kind: 'http', status: 429 })
  })

  it('maps malformed payloads', async () => {
    const fetchImpl = stub({ price: 'nope' })
    await expect(
      getFinnhubQuote(target, opts(fetchImpl))
    ).rejects.toMatchObject({ kind: 'malformed' })
  })

  it('throws missing_key without a key', async () => {
    vi.stubEnv('FINNHUB_API_KEY', '')
    await expect(
      getFinnhubQuote(target, { fetchImpl: stub({ c: 1, t: 1 }) })
    ).rejects.toMatchObject({ kind: 'missing_key' })
    vi.unstubAllEnvs()
  })

  it('throws malformed for a target without a ticker', async () => {
    await expect(
      getFinnhubQuote({ ...target, ticker: null }, opts(stub({ c: 1, t: 1 })))
    ).rejects.toBeInstanceOf(ProviderError)
  })
})

describe('searchFinnhubSymbols', () => {
  it('maps result items and asset types', async () => {
    const fetchImpl = stub({
      count: 3,
      result: [
        {
          description: 'APPLE INC',
          displaySymbol: 'AAPL',
          symbol: 'AAPL',
          type: 'Common Stock',
        },
        {
          description: 'VANGUARD SP500',
          displaySymbol: 'VUSA.L',
          symbol: 'VUSA.L',
          type: 'ETP',
        },
        {
          description: 'SOME FUND',
          displaySymbol: 'FUNDX',
          symbol: 'FUNDX',
          type: 'Open-End Fund',
        },
      ],
    })
    const results = await searchFinnhubSymbols('apple', opts(fetchImpl))
    expect(results).toHaveLength(3)
    expect(results[0]).toEqual({
      assetType: 'stock',
      coingeckoId: null,
      currency: null,
      exchange: null,
      isin: null,
      name: 'APPLE INC',
      ticker: 'AAPL',
    })
    expect(results[1]?.assetType).toBe('etf')
    expect(results[2]?.assetType).toBe('fund')
  })

  it('drops malformed items instead of failing the search', async () => {
    const fetchImpl = stub({
      count: 2,
      result: [{ bogus: true }, { description: 'OK', symbol: 'OK', type: '' }],
    })
    const results = await searchFinnhubSymbols('ok', opts(fetchImpl))
    expect(results).toHaveLength(1)
    expect(results[0]?.ticker).toBe('OK')
  })
})

describe('getFinnhubStockProfile', () => {
  it('maps profile2 fields and keeps the raw payload', async () => {
    const body = {
      currency: 'USD',
      exchange: 'NASDAQ NMS - GLOBAL MARKET',
      name: 'Apple Inc',
      ticker: 'AAPL',
      weburl: 'https://www.apple.com/',
    }
    const p = await getFinnhubStockProfile('AAPL', opts(stub(body)))
    expect(p.currency).toBe('USD')
    expect(p.exchange).toContain('NASDAQ')
    expect(p.isin).toBeNull()
    expect(p.raw).toEqual(body)
  })

  it('maps the empty profile to not_found', async () => {
    await expect(
      getFinnhubStockProfile('NOPE', opts(stub({})))
    ).rejects.toMatchObject({ kind: 'not_found' })
  })
})
