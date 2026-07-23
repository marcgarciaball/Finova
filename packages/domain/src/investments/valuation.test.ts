import { describe, expect, it } from 'vitest'
import { valueHolding } from './valuation'

describe('valueHolding', () => {
  it('values a position at the current price', () => {
    const v = valueHolding({ quantity: 10, investedCents: 100000 }, 12000)
    expect(v.currentValueCents).toBe(120000)
    expect(v.unrealizedPlCents).toBe(20000)
    expect(v.unrealizedPlPct).toBeCloseTo(20, 6)
  })

  it('rounds fractional-quantity values once', () => {
    const v = valueHolding({ quantity: 0.333, investedCents: 1000 }, 10000)
    expect(v.currentValueCents).toBe(3330)
  })

  it('returns all nulls without a quote', () => {
    expect(valueHolding({ quantity: 10, investedCents: 100000 }, null)).toEqual(
      {
        currentValueCents: null,
        unrealizedPlCents: null,
        unrealizedPlPct: null,
      }
    )
  })

  it('guards the percentage when invested is zero', () => {
    const v = valueHolding({ quantity: 1, investedCents: 0 }, 5000)
    expect(v.currentValueCents).toBe(5000)
    expect(v.unrealizedPlCents).toBe(5000)
    expect(v.unrealizedPlPct).toBeNull()
  })
})
