import { describe, expect, it } from 'vitest'
import {
  isSingleCurrency,
  summarizeByCurrency,
  summarizeInBase,
  type TxLike,
} from './totals'

const tx = (
  amount_cents: number,
  currency = 'EUR',
  is_transfer = false
): TxLike => ({ amount_cents, currency, is_transfer })

describe('summarizeByCurrency', () => {
  it('splits income and expense by sign', () => {
    const out = summarizeByCurrency([tx(1000), tx(-400), tx(250)])
    expect(out.EUR).toEqual({ income: 1250, expense: 400, net: 850 })
  })

  it('excludes transfers from every total (P1-06)', () => {
    const out = summarizeByCurrency([
      tx(1000),
      tx(-5000, 'EUR', true), // transfer out — ignored
      tx(5000, 'EUR', true), // transfer in — ignored
      tx(-300),
    ])
    expect(out.EUR).toEqual({ income: 1000, expense: 300, net: 700 })
  })

  it('keeps currencies separate', () => {
    const out = summarizeByCurrency([
      tx(1000, 'EUR'),
      tx(2000, 'USD'),
      tx(-500, 'USD'),
    ])
    expect(out.EUR).toEqual({ income: 1000, expense: 0, net: 1000 })
    expect(out.USD).toEqual({ income: 2000, expense: 500, net: 1500 })
  })

  it('returns an empty object for no rows', () => {
    expect(summarizeByCurrency([])).toEqual({})
  })

  it('treats a zero amount as income (boundary, though DB forbids zero)', () => {
    expect(summarizeByCurrency([tx(0)]).EUR).toEqual({
      income: 0,
      expense: 0,
      net: 0,
    })
  })
})

describe('summarizeInBase', () => {
  it('sums same-currency rows with no rates needed', () => {
    const out = summarizeInBase([tx(1000), tx(-400)], 'EUR')
    expect(out.income).toEqual({ amount: 1000, currency: 'EUR' })
    expect(out.expense).toEqual({ amount: 400, currency: 'EUR' })
    expect(out.net).toEqual({ amount: 600, currency: 'EUR' })
  })

  it('converts foreign rows via the rate table', () => {
    // 1 USD = 0.92 EUR. 2000 USD cents -> 1840 EUR cents.
    const out = summarizeInBase([tx(1000, 'EUR'), tx(2000, 'USD')], 'EUR', {
      USD: 0.92,
    })
    expect(out.income).toEqual({ amount: 1000 + 1840, currency: 'EUR' })
  })

  it('excludes transfers before converting', () => {
    const out = summarizeInBase(
      [tx(1000, 'EUR'), tx(-9999, 'USD', true)],
      'EUR',
      { USD: 0.92 }
    )
    expect(out.net).toEqual({ amount: 1000, currency: 'EUR' })
  })

  it('throws on a missing rate', () => {
    expect(() => summarizeInBase([tx(100, 'JPY')], 'EUR')).toThrow(/missing/)
  })
})

describe('isSingleCurrency', () => {
  it('ignores transfers when deciding', () => {
    expect(
      isSingleCurrency([tx(100, 'EUR'), tx(100, 'USD', true)], 'EUR')
    ).toBe(true)
  })
  it('is false when a spendable row differs', () => {
    expect(isSingleCurrency([tx(100, 'USD')], 'EUR')).toBe(false)
  })
})
