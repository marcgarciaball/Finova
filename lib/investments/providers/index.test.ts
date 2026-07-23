import { describe, expect, it, vi } from 'vitest'
import { getQuote, searchSymbol } from './index'
import type { QuoteTarget } from './types'

const jsonRes = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as Response

describe('getQuote routing', () => {
  it('routes stock/etf/fund to finnhub', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes({ c: 100, t: 1 })
    ) as unknown as typeof fetch
    const target: QuoteTarget = {
      coingeckoId: null,
      currency: 'USD',
      ticker: 'AAPL',
      type: 'fund',
    }
    const q = await getQuote(target, { apiKey: 'k', fetchImpl })
    expect(q.priceCents).toBe(10000)
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as string
    expect(url).toContain('finnhub.io')
  })

  it('routes crypto to coingecko', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes({ bitcoin: { eur: 5 } })
    ) as unknown as typeof fetch
    const target: QuoteTarget = {
      coingeckoId: 'bitcoin',
      currency: 'EUR',
      ticker: 'BTC',
      type: 'crypto',
    }
    const q = await getQuote(target, { fetchImpl })
    expect(q.priceCents).toBe(500)
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as string
    expect(url).toContain('coingecko.com')
  })

  it('falls back to yahoo when finnhub rejects the exchange', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('finnhub.io')) {
        return { ok: false, status: 403, json: async () => ({}) } as Response
      }
      return jsonRes({
        chart: {
          result: [
            {
              meta: {
                currency: 'USD',
                regularMarketPrice: 75.42,
                regularMarketTime: 1750000000,
              },
            },
          ],
        },
      })
    }) as unknown as typeof fetch
    const target: QuoteTarget = {
      coingeckoId: null,
      currency: 'USD',
      ticker: 'VUSD.L',
      type: 'etf',
    }
    const q = await getQuote(target, { apiKey: 'k', fetchImpl })
    expect(q.provider).toBe('yahoo')
    expect(q.priceCents).toBe(7542)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})

describe('searchSymbol routing', () => {
  it('routes listed assets to finnhub', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes({ count: 0, result: [] })
    ) as unknown as typeof fetch
    await searchSymbol('apple', 'etf', { apiKey: 'k', fetchImpl })
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as string
    expect(url).toContain('finnhub.io')
  })

  it('routes crypto to coingecko', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes({ coins: [] })
    ) as unknown as typeof fetch
    await searchSymbol('btc', 'crypto', { fetchImpl })
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as string
    expect(url).toContain('coingecko.com')
  })
})
