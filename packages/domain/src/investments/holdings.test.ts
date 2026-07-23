import { describe, expect, it } from 'vitest'
import {
  computeHolding,
  type HoldingTxn,
  MixedCurrencyError,
  OversellError,
} from './holdings'

function buy(
  quantity: number,
  priceCents: number,
  opts: Partial<HoldingTxn> = {}
): HoldingTxn {
  return {
    type: 'buy',
    quantity,
    priceCents,
    feesCents: 0,
    currency: 'USD',
    tradedAt: '2026-01-01',
    ...opts,
  }
}

function sell(
  quantity: number,
  priceCents: number,
  opts: Partial<HoldingTxn> = {}
): HoldingTxn {
  return { ...buy(quantity, priceCents, opts), type: 'sell' }
}

describe('computeHolding', () => {
  it('returns the empty holding for no transactions', () => {
    expect(computeHolding([])).toEqual({
      quantity: 0,
      avgCostCents: 0,
      investedCents: 0,
      realizedPlCents: 0,
    })
  })

  it('computes a single buy with fees folded into cost basis', () => {
    const h = computeHolding([buy(10, 19000, { feesCents: 500 })])
    expect(h.quantity).toBe(10)
    expect(h.investedCents).toBe(190500)
    expect(h.avgCostCents).toBe(19050)
    expect(h.realizedPlCents).toBe(0)
  })

  it('weight-averages multiple buys', () => {
    // 10 @ 100.00 + 20 @ 130.00 → avg 120.00
    const h = computeHolding([buy(10, 10000), buy(20, 13000)])
    expect(h.quantity).toBe(30)
    expect(h.avgCostCents).toBe(12000)
    expect(h.investedCents).toBe(360000)
  })

  it('sells at average cost and realizes P/L net of fees', () => {
    // buy 10 @ 100.00, sell 4 @ 150.00 with 2.00 fees
    const h = computeHolding([
      buy(10, 10000),
      sell(4, 15000, { feesCents: 200, tradedAt: '2026-02-01' }),
    ])
    expect(h.quantity).toBe(6)
    expect(h.avgCostCents).toBe(10000) // unchanged by the sell
    expect(h.investedCents).toBe(60000)
    expect(h.realizedPlCents).toBe(4 * (15000 - 10000) - 200)
  })

  it('handles buy-sell-buy sequences', () => {
    const h = computeHolding([
      buy(10, 10000, { tradedAt: '2026-01-01' }),
      sell(5, 12000, { tradedAt: '2026-02-01' }),
      buy(5, 8000, { tradedAt: '2026-03-01' }),
    ])
    // After sell: 5 @ 100.00 basis 50000. Buy 5 @ 80.00 → basis 90000 / 10.
    expect(h.quantity).toBe(10)
    expect(h.avgCostCents).toBe(9000)
    expect(h.investedCents).toBe(90000)
    expect(h.realizedPlCents).toBe(5 * (12000 - 10000))
  })

  it('fully liquidates to a zero position', () => {
    const h = computeHolding([
      buy(3, 10000),
      sell(3, 11000, { tradedAt: '2026-02-01' }),
    ])
    expect(h.quantity).toBe(0)
    expect(h.investedCents).toBe(0)
    expect(h.avgCostCents).toBe(0)
    expect(h.realizedPlCents).toBe(3000)
  })

  it('orders by tradedAt regardless of input order', () => {
    // The sell happens AFTER both buys chronologically.
    const h = computeHolding([
      sell(15, 12000, { tradedAt: '2026-03-01' }),
      buy(10, 10000, { tradedAt: '2026-01-01' }),
      buy(10, 14000, { tradedAt: '2026-02-01' }),
    ])
    expect(h.quantity).toBe(5)
    expect(h.avgCostCents).toBe(12000)
  })

  it('is exact for 8-decimal crypto quantities', () => {
    const h = computeHolding([
      buy(0.1, 5000000000),
      buy(0.2, 5000000000, { tradedAt: '2026-01-02' }),
      sell(0.29999999, 6000000000, { tradedAt: '2026-01-03' }),
    ])
    expect(h.quantity).toBeCloseTo(0.00000001, 10)
    expect(h.realizedPlCents).toBe(Math.round(0.29999999 * 1000000000))
  })

  it('throws OversellError when selling more than held', () => {
    expect(() =>
      computeHolding([
        buy(1, 10000),
        sell(2, 10000, { tradedAt: '2026-02-01' }),
      ])
    ).toThrow(OversellError)
  })

  it('reports the offending transaction on oversell', () => {
    try {
      computeHolding([
        buy(1, 10000),
        sell(2, 10000, { tradedAt: '2026-02-01' }),
      ])
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(OversellError)
      expect((e as OversellError).tradedAt).toBe('2026-02-01')
      expect((e as OversellError).txnIndex).toBe(1)
    }
  })

  it('throws MixedCurrencyError on mixed currencies', () => {
    expect(() =>
      computeHolding([buy(1, 10000), buy(1, 10000, { currency: 'EUR' })])
    ).toThrow(MixedCurrencyError)
  })
})
