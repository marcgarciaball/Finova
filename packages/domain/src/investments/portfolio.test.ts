import { describe, expect, it } from 'vitest'
import {
  computePortfolioTotals,
  convertCents,
  type FxRateTable,
  fxKey,
  MissingRateError,
  topMovers,
  type ValuedHolding,
} from './portfolio'

const rates: FxRateTable = new Map([
  [fxKey('USD', 'EUR'), 0.9],
  [fxKey('GBP', 'EUR'), 1.2],
])

function holding(over: Partial<ValuedHolding>): ValuedHolding {
  return {
    assetType: 'stock',
    currency: 'EUR',
    investedCents: 100000,
    currentValueCents: 110000,
    unrealizedPlPct: 10,
    ...over,
  }
}

describe('convertCents', () => {
  it('is the identity within one currency (no rate needed)', () => {
    expect(convertCents(12345, 'EUR', 'EUR', new Map())).toBe(12345)
  })
  it('converts and rounds once', () => {
    expect(convertCents(10001, 'USD', 'EUR', rates)).toBe(9001) // 9000.9 → 9001
  })
  it('throws MissingRateError for an unmapped pair', () => {
    expect(() => convertCents(100, 'JPY', 'EUR', rates)).toThrow(
      MissingRateError
    )
  })
})

describe('computePortfolioTotals', () => {
  it('sums a single-currency portfolio', () => {
    const t = computePortfolioTotals(
      [
        holding({}),
        holding({ investedCents: 50000, currentValueCents: 40000 }),
      ],
      'EUR',
      new Map()
    )
    expect(t.totalInvestedCents).toBe(150000)
    expect(t.totalValueCents).toBe(150000)
    expect(t.totalPlCents).toBe(0)
    expect(t.totalPlPct).toBe(0)
    expect(t.unpricedCount).toBe(0)
  })

  it('converts foreign holdings to base currency before summing', () => {
    const t = computePortfolioTotals(
      [
        holding({
          currency: 'USD',
          investedCents: 100000,
          currentValueCents: 120000,
        }),
        holding({}),
      ],
      'EUR',
      rates
    )
    expect(t.totalInvestedCents).toBe(90000 + 100000)
    expect(t.totalValueCents).toBe(108000 + 110000)
  })

  it('excludes unpriced holdings from value and P/L but not invested', () => {
    const t = computePortfolioTotals(
      [
        holding({}),
        holding({
          investedCents: 70000,
          currentValueCents: null,
          unrealizedPlPct: null,
        }),
      ],
      'EUR',
      new Map()
    )
    expect(t.totalInvestedCents).toBe(170000)
    expect(t.pricedInvestedCents).toBe(100000)
    expect(t.totalValueCents).toBe(110000)
    expect(t.totalPlCents).toBe(10000)
    expect(t.totalPlPct).toBeCloseTo(10, 6)
    expect(t.unpricedCount).toBe(1)
  })

  it('computes allocations as fractions of total value', () => {
    const t = computePortfolioTotals(
      [
        holding({ assetType: 'stock', currentValueCents: 75000 }),
        holding({
          assetType: 'crypto',
          currency: 'USD',
          currentValueCents: 27778, // ≈25000 EUR
        }),
      ],
      'EUR',
      rates
    )
    expect(t.allocationByType.stock).toBeCloseTo(0.75, 3)
    expect(t.allocationByType.crypto).toBeCloseTo(0.25, 3)
    expect(t.allocationByCurrency.EUR).toBeCloseTo(0.75, 3)
    expect(t.allocationByCurrency.USD).toBeCloseTo(0.25, 3)
  })

  it('returns null percentage and empty allocations for an empty portfolio', () => {
    const t = computePortfolioTotals([], 'EUR', new Map())
    expect(t.totalPlPct).toBeNull()
    expect(t.allocationByType).toEqual({})
    expect(t.allocationByCurrency).toEqual({})
  })
})

describe('topMovers', () => {
  const hs = [
    holding({ unrealizedPlPct: 5 }),
    holding({ unrealizedPlPct: -20 }),
    holding({ unrealizedPlPct: 42 }),
    holding({ unrealizedPlPct: null }),
    holding({ unrealizedPlPct: -3 }),
  ]

  it('ranks winners descending and losers ascending, skipping unpriced', () => {
    const { winners, losers } = topMovers(hs, 2)
    expect(winners.map((h) => h.unrealizedPlPct)).toEqual([42, 5])
    expect(losers.map((h) => h.unrealizedPlPct)).toEqual([-20, -3])
  })

  it('returns fewer than n when the portfolio is small', () => {
    const { winners } = topMovers(hs, 10)
    expect(winners).toHaveLength(4)
  })
})
