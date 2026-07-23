import { describe, expect, it } from 'vitest'
import { type ExpenseTxn, topExpenses } from './top-expenses'

const txn = (
  id: string,
  amount_cents: number,
  description = 'x',
  currency = 'EUR',
  is_transfer = false,
  occurred_at = '2026-01-01T00:00:00.000Z'
): ExpenseTxn => ({
  id,
  amount_cents,
  description,
  currency,
  is_transfer,
  occurred_at,
})

describe('topExpenses', () => {
  it('returns the largest expenses sorted descending, capped at limit', () => {
    const out = topExpenses(
      [
        txn('a', -1_000),
        txn('b', -5_000),
        txn('c', -3_000),
        txn('d', 10_000), // income — ignored
      ],
      2
    )
    expect((out.EUR ?? []).map((e) => e.id)).toEqual(['b', 'c'])
    expect(out.EUR?.[0]?.amountCents).toBe(5_000)
  })

  it('excludes transfers', () => {
    const out = topExpenses([txn('a', -9_999, 'x', 'EUR', true)], 5)
    expect(out.EUR).toBeUndefined()
  })

  it('keeps currencies separate', () => {
    const out = topExpenses(
      [txn('a', -1_000, 'x', 'EUR'), txn('b', -2_000, 'x', 'USD')],
      5
    )
    expect(out.EUR?.[0]?.id).toBe('a')
    expect(out.USD?.[0]?.id).toBe('b')
  })

  it('returns an empty map for no rows', () => {
    expect(topExpenses([], 5)).toEqual({})
  })
})
