import { describe, expect, it } from 'vitest'
import { buildHoldingRows, type RebuildTxn } from './rebuild'

const txn = (over: Partial<RebuildTxn>): RebuildTxn => ({
  assetId: 'a1',
  currency: 'USD',
  feesCents: 0,
  portfolioId: 'p1',
  priceCents: 10000,
  quantity: 10,
  tradedAt: '2026-01-01',
  type: 'buy',
  userId: 'u1',
  ...over,
})

describe('buildHoldingRows', () => {
  it('groups per portfolio+asset and applies matching quotes', () => {
    const { rows, skipped } = buildHoldingRows(
      [
        txn({}),
        txn({
          tradedAt: '2026-02-01',
          type: 'sell',
          quantity: 4,
          priceCents: 15000,
        }),
        txn({ assetId: 'a2', quantity: 1 }),
      ],
      new Map([
        ['a1', { currency: 'USD', priceCents: 12000 }],
        ['a2', { currency: 'EUR', priceCents: 999 }], // currency mismatch → unpriced
      ])
    )
    expect(skipped).toEqual([])
    expect(rows).toHaveLength(2)
    const a1 = rows.find((r) => r.asset_id === 'a1')
    expect(a1).toMatchObject({
      current_price_cents: 12000,
      current_value_cents: 72000,
      invested_cents: 60000,
      quantity: 6,
      realized_pl_cents: 20000,
      unrealized_pl_cents: 12000,
    })
    const a2 = rows.find((r) => r.asset_id === 'a2')
    expect(a2?.current_price_cents).toBeNull()
    expect(a2?.unrealized_pl_pct).toBeNull()
  })

  it('skips groups that violate domain invariants', () => {
    const { rows, skipped } = buildHoldingRows(
      [txn({}), txn({ tradedAt: '2026-02-01', type: 'sell', quantity: 99 })],
      new Map()
    )
    expect(rows).toEqual([])
    expect(skipped).toEqual(['p1:a1'])
  })
})
