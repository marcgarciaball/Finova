import { describe, expect, it } from 'vitest'
import { aggregatePortfolio, type ManualAssetSnapshot } from './metrics'

function asset(
  overrides: Partial<ManualAssetSnapshot> = {}
): ManualAssetSnapshot {
  return {
    currency: 'EUR',
    currentValueCents: 10_000_00, // 10 000 €
    isClosed: false,
    ...overrides,
  }
}

describe('aggregatePortfolio', () => {
  it('sums value per currency', () => {
    const totals = aggregatePortfolio([
      asset({ currentValueCents: 5_000_00 }),
      asset({ currentValueCents: 3_000_00 }),
    ])
    expect(totals).toEqual([
      { assetCount: 2, currency: 'EUR', valueCents: 8_000_00 },
    ])
  })

  it('keeps currencies separate', () => {
    const totals = aggregatePortfolio([
      asset({ currency: 'EUR', currentValueCents: 5_000_00 }),
      asset({ currency: 'USD', currentValueCents: 3_000_00 }),
    ])
    expect(totals).toEqual(
      expect.arrayContaining([
        { assetCount: 1, currency: 'EUR', valueCents: 5_000_00 },
        { assetCount: 1, currency: 'USD', valueCents: 3_000_00 },
      ])
    )
  })

  it('excludes closed assets from value and count', () => {
    const totals = aggregatePortfolio([
      asset({ currentValueCents: 5_000_00 }),
      asset({ currentValueCents: 3_000_00, isClosed: true }),
    ])
    expect(totals).toEqual([
      { assetCount: 1, currency: 'EUR', valueCents: 5_000_00 },
    ])
  })

  it('returns an empty array for no assets', () => {
    expect(aggregatePortfolio([])).toEqual([])
  })
})
