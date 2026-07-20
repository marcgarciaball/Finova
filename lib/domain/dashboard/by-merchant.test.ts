import { describe, expect, it } from 'vitest'
import { type MerchantTxn, spendingByMerchant } from './by-merchant'

const txn = (
  amount_cents: number,
  description: string,
  currency = 'EUR',
  is_transfer = false
): MerchantTxn => ({ amount_cents, description, currency, is_transfer })

describe('spendingByMerchant', () => {
  it('groups expenses by merchant description and ignores income', () => {
    const out = spendingByMerchant([
      txn(-1_000, 'Carrefour'),
      txn(-2_000, 'Carrefour'),
      txn(-500, 'Netflix'),
      txn(5_000, 'Salary'), // income — ignored
    ])
    const eur = out.EUR ?? []
    expect(eur.find((m) => m.merchant === 'Carrefour')).toMatchObject({
      total: 3_000,
      count: 2,
    })
    expect(eur.find((m) => m.merchant === 'Netflix')?.total).toBe(500)
    expect(eur.some((m) => m.merchant === 'Salary')).toBe(false)
  })

  it('excludes transfers even when described', () => {
    const out = spendingByMerchant([
      txn(-1_000, 'Carrefour'),
      txn(-9_999, 'Carrefour', 'EUR', true),
    ])
    expect(out.EUR?.[0]?.total).toBe(1_000)
  })

  it('trims whitespace and drops empty descriptions', () => {
    const out = spendingByMerchant([
      txn(-1_000, '  Carrefour  '),
      txn(-500, ''),
    ])
    expect(out.EUR).toEqual([
      { merchant: 'Carrefour', total: 1_000, count: 1, share: 1 },
    ])
  })

  it('sorts by total descending', () => {
    const out = spendingByMerchant([txn(-1_000, 'small'), txn(-5_000, 'big')])
    expect((out.EUR ?? []).map((m) => m.merchant)).toEqual(['big', 'small'])
  })

  it('returns an empty map for no rows', () => {
    expect(spendingByMerchant([])).toEqual({})
  })
})
