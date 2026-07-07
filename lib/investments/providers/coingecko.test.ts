import { describe, expect, it, vi } from 'vitest'
import { getCoinGeckoQuote, searchCoinGeckoSymbols } from './coingecko'
import type { QuoteTarget } from './types'

const jsonRes = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response

const stub = (body: unknown, status = 200) =>
  vi.fn(async () => jsonRes(body, status)) as unknown as typeof fetch

const target: QuoteTarget = {
  coingeckoId: 'bitcoin',
  currency: 'EUR',
  ticker: 'BTC',
  type: 'crypto',
}

describe('getCoinGeckoQuote', () => {
  it('reads the price for the asset currency and converts to cents', async () => {
    const fetchImpl = stub({ bitcoin: { eur: 91234.567 } })
    const q = await getCoinGeckoQuote(target, { fetchImpl })
    expect(q.priceCents).toBe(9123457)
    expect(q.currency).toBe('EUR')
    expect(q.quoteType).toBe('live')
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as string
    expect(url).toContain('ids=bitcoin')
    expect(url).toContain('vs_currencies=eur')
  })

  it('maps a missing coin to not_found', async () => {
    const fetchImpl = stub({})
    await expect(
      getCoinGeckoQuote(target, { fetchImpl })
    ).rejects.toMatchObject({ kind: 'not_found', provider: 'coingecko' })
  })

  it('maps HTTP errors', async () => {
    const fetchImpl = stub({}, 500)
    await expect(
      getCoinGeckoQuote(target, { fetchImpl })
    ).rejects.toMatchObject({ kind: 'http', status: 500 })
  })

  it('throws malformed for a target without a coingecko id', async () => {
    await expect(
      getCoinGeckoQuote(
        { ...target, coingeckoId: null },
        { fetchImpl: stub({}) }
      )
    ).rejects.toMatchObject({ kind: 'malformed' })
  })
})

describe('searchCoinGeckoSymbols', () => {
  it('maps coins to crypto symbol results', async () => {
    const fetchImpl = stub({
      coins: [
        { id: 'bitcoin', market_cap_rank: 1, name: 'Bitcoin', symbol: 'btc' },
      ],
    })
    const results = await searchCoinGeckoSymbols('bitcoin', { fetchImpl })
    expect(results).toEqual([
      {
        assetType: 'crypto',
        coingeckoId: 'bitcoin',
        currency: null,
        exchange: null,
        isin: null,
        name: 'Bitcoin',
        ticker: 'BTC',
      },
    ])
  })

  it('drops malformed coins', async () => {
    const fetchImpl = stub({
      coins: [{ nope: 1 }, { id: 'ethereum', name: 'Ethereum', symbol: 'eth' }],
    })
    const results = await searchCoinGeckoSymbols('eth', { fetchImpl })
    expect(results).toHaveLength(1)
    expect(results[0]?.coingeckoId).toBe('ethereum')
  })
})
