import { describe, expect, it, vi } from 'vitest'
import type { QuoteTarget } from './types'
import { getYahooDividends, getYahooQuote } from './yahoo'

const jsonRes = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response

const stub = (body: unknown, status = 200) =>
  vi.fn(async () => jsonRes(body, status)) as unknown as typeof fetch

const target: QuoteTarget = {
  coingeckoId: null,
  currency: 'USD',
  ticker: 'VUSD.L',
  type: 'etf',
}

describe('getYahooQuote', () => {
  it('converts the chart price to integer cents', async () => {
    const fetchImpl = stub({
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
    const q = await getYahooQuote(target, { fetchImpl })
    expect(q.priceCents).toBe(7542)
    expect(q.currency).toBe('USD')
    expect(q.provider).toBe('yahoo')
    expect(q.fetchedAt).toBe(new Date(1750000000 * 1000).toISOString())
  })

  it('requests the ticker verbatim', async () => {
    const fetchImpl = stub({
      chart: {
        result: [{ meta: { regularMarketPrice: 1, regularMarketTime: 1 } }],
      },
    })
    await getYahooQuote(target, { fetchImpl })
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as string
    expect(url).toContain('/chart/VUSD.L')
  })

  it('maps an empty result to not_found', async () => {
    const fetchImpl = stub({ chart: { result: [] } })
    await expect(getYahooQuote(target, { fetchImpl })).rejects.toMatchObject({
      kind: 'not_found',
      provider: 'yahoo',
    })
  })

  it('maps HTTP errors', async () => {
    const fetchImpl = stub({}, 404)
    await expect(getYahooQuote(target, { fetchImpl })).rejects.toMatchObject({
      kind: 'http',
      status: 404,
    })
  })

  it('maps malformed payloads', async () => {
    const fetchImpl = stub({ nope: true })
    await expect(getYahooQuote(target, { fetchImpl })).rejects.toMatchObject({
      kind: 'malformed',
    })
  })

  it('throws malformed for a target without a ticker', async () => {
    await expect(
      getYahooQuote({ ...target, ticker: null }, { fetchImpl: stub({}) })
    ).rejects.toMatchObject({ kind: 'malformed' })
  })
})

describe('getYahooDividends', () => {
  it('maps chart events into sorted dividend rows', async () => {
    const fetchImpl = stub({
      chart: {
        result: [
          {
            events: {
              dividends: {
                1638316800: { amount: 0.38058, date: 1639641600 },
                1630450800: { amount: 0.371505, date: 1631775600 },
              },
            },
          },
        ],
      },
    })
    const events = await getYahooDividends('VHYL.L', { fetchImpl })
    expect(events).toEqual([
      {
        amountPerShare: 0.371505,
        exDate: new Date(1631775600 * 1000).toISOString().slice(0, 10),
        payDate: null,
      },
      {
        amountPerShare: 0.38058,
        exDate: new Date(1639641600 * 1000).toISOString().slice(0, 10),
        payDate: null,
      },
    ])
  })

  it('returns an empty array when there are no dividend events', async () => {
    const fetchImpl = stub({ chart: { result: [{ events: {} }] } })
    expect(await getYahooDividends('VUSD.L', { fetchImpl })).toEqual([])
  })

  it('maps HTTP errors', async () => {
    const fetchImpl = stub({}, 500)
    await expect(
      getYahooDividends('VHYL.L', { fetchImpl })
    ).rejects.toMatchObject({ kind: 'http', status: 500 })
  })

  it('maps malformed payloads', async () => {
    const fetchImpl = stub({ nope: true })
    await expect(
      getYahooDividends('VHYL.L', { fetchImpl })
    ).rejects.toMatchObject({ kind: 'malformed' })
  })
})
