import { describe, expect, it } from 'vitest'
import { dailyValueSeries } from './history'

const txns = [
  {
    assetId: 'a1',
    currency: 'USD',
    quantity: 10,
    tradedAt: '2026-01-01',
    type: 'buy' as const,
  },
  {
    assetId: 'a1',
    currency: 'USD',
    quantity: 10,
    tradedAt: '2026-01-03',
    type: 'buy' as const,
  },
]

const prices = [
  { assetId: 'a1', closeCents: 10000, date: '2026-01-01' },
  // no 2026-01-02 close (weekend) → carried forward
  { assetId: 'a1', closeCents: 12000, date: '2026-01-03' },
]

const fx = [
  { date: '2026-01-01', fromCcy: 'USD', rate: 0.9, toCcy: 'EUR' },
  { date: '2026-01-03', fromCcy: 'USD', rate: 0.8, toCcy: 'EUR' },
]

describe('dailyValueSeries', () => {
  it('walks quantities, carries prices and rates forward, converts to base', () => {
    const s = dailyValueSeries(txns, prices, fx, 'EUR', '2026-01-04')
    expect(s).toEqual([
      { date: '2026-01-01', valueCents: 90000 }, // 10 × $100 × 0.9
      { date: '2026-01-02', valueCents: 90000 }, // carried close + rate
      { date: '2026-01-03', valueCents: 192000 }, // 20 × $120 × 0.8
      { date: '2026-01-04', valueCents: 192000 },
    ])
  })

  it('skips days before the first known price', () => {
    const s = dailyValueSeries(
      txns,
      [{ assetId: 'a1', closeCents: 12000, date: '2026-01-03' }],
      fx,
      'EUR',
      '2026-01-03'
    )
    expect(s).toEqual([{ date: '2026-01-03', valueCents: 192000 }])
  })

  it('returns empty for no transactions', () => {
    expect(dailyValueSeries([], prices, fx, 'EUR', '2026-01-04')).toEqual([])
  })
})
