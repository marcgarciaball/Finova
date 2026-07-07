import { describe, expect, it, vi } from 'vitest'
import { fetchDailyRates } from './fx'

const jsonRes = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response

const stub = (body: unknown, status = 200) =>
  vi.fn(async () => jsonRes(body, status)) as unknown as typeof fetch

describe('fetchDailyRates', () => {
  it('shapes provider rates into fx_rates rows', async () => {
    const fetchImpl = stub({
      amount: 1,
      base: 'USD',
      date: '2026-07-06',
      rates: { CHF: 0.79, EUR: 0.85, GBP: 0.73 },
    })
    const out = await fetchDailyRates('USD', ['EUR', 'GBP', 'CHF'], {
      fetchImpl,
    })
    expect(out.rateDate).toBe('2026-07-06')
    expect(out.rates).toContainEqual({
      fromCcy: 'USD',
      rate: 0.85,
      toCcy: 'EUR',
    })
    expect(out.rates).toHaveLength(3)
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as string
    expect(url).toContain('from=USD')
    expect(url).toContain('to=EUR,GBP,CHF')
  })

  it('maps HTTP errors', async () => {
    await expect(
      fetchDailyRates('USD', ['EUR'], { fetchImpl: stub({}, 502) })
    ).rejects.toMatchObject({ kind: 'http', provider: 'frankfurter' })
  })

  it('maps malformed payloads', async () => {
    await expect(
      fetchDailyRates('USD', ['EUR'], { fetchImpl: stub({ nope: 1 }) })
    ).rejects.toMatchObject({ kind: 'malformed' })
  })
})
