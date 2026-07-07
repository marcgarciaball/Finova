import { describe, expect, it } from 'vitest'
import {
  dividendsByYearCents,
  dividendsReceivedCents,
  quantityHeldOn,
  trailing12mPerShareCents,
} from './dividends'

const txns = [
  { quantity: 100, tradedAt: '2025-01-10', type: 'buy' as const },
  { quantity: 40, tradedAt: '2025-06-01', type: 'sell' as const },
]

const events = [
  { amountPerShare: 0.25, exDate: '2024-11-01', payDate: '2024-11-15' }, // before purchase
  { amountPerShare: 0.25, exDate: '2025-02-01', payDate: '2025-02-15' }, // 100 held
  { amountPerShare: 0.26, exDate: '2025-08-01', payDate: '2025-08-15' }, // 60 held
]

describe('quantityHeldOn', () => {
  it('replays buys and sells up to the date', () => {
    expect(quantityHeldOn(txns, '2025-01-09')).toBe(0)
    expect(quantityHeldOn(txns, '2025-02-01')).toBe(100)
    expect(quantityHeldOn(txns, '2025-08-01')).toBe(60)
  })
})

describe('dividendsReceivedCents', () => {
  it('pays only for shares held on each ex-date', () => {
    // 100 × 0.25 + 60 × 0.26 = 25.00 + 15.60
    expect(dividendsReceivedCents(txns, events)).toBe(2500 + 1560)
  })
})

describe('trailing12mPerShareCents', () => {
  it('sums per-share amounts within the trailing year', () => {
    expect(trailing12mPerShareCents(events, '2026-01-15')).toBe(51)
    expect(trailing12mPerShareCents(events, '2025-06-30')).toBe(50)
  })
})

describe('dividendsByYearCents', () => {
  it('groups received amounts by ex-date year', () => {
    expect(dividendsByYearCents(txns, events)).toEqual({ '2025': 4060 })
  })
})
