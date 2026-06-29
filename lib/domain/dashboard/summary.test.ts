import { describe, expect, it } from 'vitest'
import {
  accountBalances,
  type BalanceAccount,
  type BalanceTxn,
  savingsRate,
  totalBalanceByCurrency,
} from './summary'

const acc = (
  id: string,
  currency: string,
  opening_balance: number
): BalanceAccount => ({ id, currency, opening_balance })

const tx = (
  account_id: string,
  amount_cents: number,
  currency: string
): BalanceTxn => ({ account_id, amount_cents, currency })

describe('accountBalances', () => {
  it('returns the opening balance when there are no transactions', () => {
    const out = accountBalances([acc('a', 'EUR', 10_000)], [])
    expect(out).toEqual([
      { accountId: 'a', currency: 'EUR', balance: 10_000, foreignCount: 0 },
    ])
  })

  it('adds income and subtracts expense via the signed amount', () => {
    const out = accountBalances(
      [acc('a', 'EUR', 10_000)],
      [tx('a', 5_000, 'EUR'), tx('a', -2_000, 'EUR')]
    )
    expect(out[0]?.balance).toBe(13_000)
  })

  it('includes transfer rows in the balance (unlike income/expense totals)', () => {
    // A transfer moves money through the account, so it changes the balance.
    const out = accountBalances(
      [acc('a', 'EUR', 0)],
      [tx('a', -5_000, 'EUR')] // outgoing transfer leg
    )
    expect(out[0]?.balance).toBe(-5_000)
  })

  it('excludes foreign-currency transactions and counts them', () => {
    const out = accountBalances(
      [acc('a', 'EUR', 1_000)],
      [tx('a', 5_000, 'EUR'), tx('a', 9_999, 'USD')]
    )
    expect(out[0]?.balance).toBe(6_000)
    expect(out[0]?.foreignCount).toBe(1)
  })

  it('keeps an untouched account at its opening balance', () => {
    const out = accountBalances(
      [acc('a', 'EUR', 1_000), acc('b', 'EUR', 2_000)],
      [tx('a', 500, 'EUR')]
    )
    expect(out.find((b) => b.accountId === 'b')?.balance).toBe(2_000)
  })

  it('preserves input order', () => {
    const out = accountBalances([acc('b', 'EUR', 0), acc('a', 'EUR', 0)], [])
    expect(out.map((b) => b.accountId)).toEqual(['b', 'a'])
  })
})

describe('totalBalanceByCurrency', () => {
  it('sums balances within a currency and never across currencies', () => {
    const balances = accountBalances(
      [acc('a', 'EUR', 1_000), acc('b', 'EUR', 2_000), acc('c', 'USD', 500)],
      []
    )
    expect(totalBalanceByCurrency(balances)).toEqual({ EUR: 3_000, USD: 500 })
  })

  it('returns an empty map for no balances', () => {
    expect(totalBalanceByCurrency([])).toEqual({})
  })
})

describe('savingsRate', () => {
  it('is net / income', () => {
    expect(savingsRate({ income: 1_000, expense: 750 })).toBe(0.25)
  })

  it('is negative when expenses exceed income (overspending)', () => {
    expect(savingsRate({ income: 1_000, expense: 1_500 })).toBe(-0.5)
  })

  it('is null when income is zero', () => {
    expect(savingsRate({ income: 0, expense: 500 })).toBeNull()
  })

  it('is null when income is negative (guarded)', () => {
    expect(savingsRate({ income: -100, expense: 0 })).toBeNull()
  })
})
