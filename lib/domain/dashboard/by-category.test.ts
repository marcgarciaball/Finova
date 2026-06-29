import { describe, expect, it } from 'vitest'
import { type CategorizedTxn, spendingByCategory } from './by-category'

const txn = (
  amount_cents: number,
  category_id: string | null,
  currency = 'EUR',
  is_transfer = false
): CategorizedTxn => ({ amount_cents, category_id, currency, is_transfer })

describe('spendingByCategory', () => {
  it('groups expenses by category and ignores income', () => {
    const out = spendingByCategory([
      txn(-3_000, 'food'),
      txn(-1_000, 'food'),
      txn(-2_000, 'transport'),
      txn(5_000, 'salary'), // income — ignored
    ])
    const eur = out.EUR ?? []
    expect(eur.find((c) => c.categoryId === 'food')).toMatchObject({
      total: 4_000,
      count: 2,
    })
    expect(eur.find((c) => c.categoryId === 'transport')?.total).toBe(2_000)
    expect(eur.some((c) => c.categoryId === 'salary')).toBe(false)
  })

  it('excludes transfers even when categorized', () => {
    const out = spendingByCategory([
      txn(-1_000, 'food'),
      txn(-9_999, 'food', 'EUR', true), // transfer — excluded
    ])
    expect(out.EUR?.[0]?.total).toBe(1_000)
  })

  it('aggregates null category into an uncategorized bucket', () => {
    const out = spendingByCategory([txn(-1_500, null), txn(-500, null)])
    expect(out.EUR).toEqual([
      { categoryId: null, total: 2_000, count: 2, share: 1 },
    ])
  })

  it('keeps currencies separate', () => {
    const out = spendingByCategory([
      txn(-1_000, 'food', 'EUR'),
      txn(-2_000, 'food', 'USD'),
    ])
    expect(out.EUR?.[0]?.total).toBe(1_000)
    expect(out.USD?.[0]?.total).toBe(2_000)
  })

  it('computes share as a fraction of the currency total', () => {
    const out = spendingByCategory([
      txn(-7_500, 'food'),
      txn(-2_500, 'transport'),
    ])
    const shares = (out.EUR ?? []).map((c) => c.share)
    expect(shares).toEqual([0.75, 0.25])
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })

  it('sorts entries by total descending', () => {
    const out = spendingByCategory([
      txn(-1_000, 'small'),
      txn(-5_000, 'big'),
      txn(-3_000, 'mid'),
    ])
    expect((out.EUR ?? []).map((c) => c.categoryId)).toEqual([
      'big',
      'mid',
      'small',
    ])
  })

  it('returns an empty map for no rows', () => {
    expect(spendingByCategory([])).toEqual({})
  })
})
