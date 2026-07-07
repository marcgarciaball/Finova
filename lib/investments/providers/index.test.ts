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
