import { describe, expect, it } from 'vitest'
import { type AccountTxn, spendingByAccount } from './by-account'

const t = (
  account_id: string,
  amount_cents: number,
  currency = 'EUR',
  is_transfer = false
): AccountTxn => ({ account_id, amount_cents, currency, is_transfer })

describe('spendingByAccount', () => {
  it('sums expense magnitude per account, per currency', () => {
    const out = spendingByAccount([
      t('a', -2_000),
      t('a', -1_000),
      t('b', -1_000),
    ])
    expect(out.EUR).toEqual([
      { accountId: 'a', total: 3_000, count: 2, share: 0.75 },
      { accountId: 'b', total: 1_000, count: 1, share: 0.25 },
    ])
  })

  it('ignores income and transfers', () => {
    const out = spendingByAccount([
      t('a', -1_000),
      t('a', 9_999), // income
      t('a', -5_000, 'EUR', true), // transfer
    ])
    expect(out.EUR).toEqual([
      { accountId: 'a', total: 1_000, count: 1, share: 1 },
    ])
  })

  it('keeps currencies separate and never sums across them', () => {
    const out = spendingByAccount([
      t('a', -1_000, 'EUR'),
      t('b', -2_000, 'USD'),
    ])
    expect(out.EUR?.[0]).toEqual({
      accountId: 'a',
      total: 1_000,
      count: 1,
      share: 1,
    })
    expect(out.USD?.[0]?.accountId).toBe('b')
  })

  it('sorts by total desc, then count desc', () => {
    const out = spendingByAccount([
      t('low', -500),
      t('high', -5_000),
      t('mid', -2_000),
    ])
    expect(out.EUR?.map((r) => r.accountId)).toEqual(['high', 'mid', 'low'])
  })

  it('returns an empty record for no spending', () => {
    expect(spendingByAccount([])).toEqual({})
    expect(spendingByAccount([t('a', 1_000)])).toEqual({})
  })
})
