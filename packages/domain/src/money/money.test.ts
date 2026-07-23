import { describe, expect, it } from 'vitest'
import {
  CurrencyMismatchError,
  InvalidAmountError,
  InvalidCurrencyError,
} from './errors'
import {
  abs,
  add,
  allocate,
  compare,
  convert,
  equals,
  fromDecimal,
  greaterThan,
  isNegative,
  isPositive,
  isZero,
  lessThan,
  money,
  multiply,
  negate,
  subtract,
  zero,
} from './money'

describe('constructors', () => {
  it('money() builds from integer cents', () => {
    expect(money(1234, 'EUR')).toEqual({ amount: 1234, currency: 'EUR' })
  })

  it('money() rejects non-integer amounts', () => {
    expect(() => money(1.5, 'EUR')).toThrow(InvalidAmountError)
  })

  it('money() rejects unsafe integers', () => {
    expect(() => money(Number.MAX_SAFE_INTEGER + 1, 'EUR')).toThrow(
      InvalidAmountError
    )
  })

  it('money() rejects NaN/Infinity', () => {
    expect(() => money(Number.NaN, 'EUR')).toThrow(InvalidAmountError)
    expect(() => money(Number.POSITIVE_INFINITY, 'EUR')).toThrow(
      InvalidAmountError
    )
  })

  it('money() rejects malformed currency codes', () => {
    for (const bad of ['eur', 'EU', 'EURO', '123', '']) {
      expect(() => money(0, bad)).toThrow(InvalidCurrencyError)
    }
  })

  it('fromDecimal() converts major units to cents without float drift', () => {
    expect(fromDecimal(12.34, 'EUR')).toEqual({ amount: 1234, currency: 'EUR' })
    expect(fromDecimal(0.1, 'EUR').amount).toBe(10)
    expect(fromDecimal(0.2, 'EUR').amount).toBe(20)
    expect(fromDecimal(-5.55, 'EUR').amount).toBe(-555)
  })

  it('fromDecimal() rounds half-up at the cent boundary', () => {
    expect(fromDecimal(1.005, 'EUR').amount).toBe(101)
    expect(fromDecimal(-1.005, 'EUR').amount).toBe(-101)
  })

  it('fromDecimal() handles integer, zero, and trailing-zero decimals', () => {
    expect(fromDecimal(5, 'EUR').amount).toBe(500)
    expect(fromDecimal(0, 'EUR').amount).toBe(0)
    expect(fromDecimal(1.1, 'EUR').amount).toBe(110)
  })

  it('fromDecimal() rejects scientific-notation inputs', () => {
    expect(() => fromDecimal(1e-7, 'EUR')).toThrow(InvalidAmountError)
    expect(() => fromDecimal(1.5e21, 'EUR')).toThrow(InvalidAmountError)
  })

  it('zero() builds a zero amount', () => {
    expect(zero('USD')).toEqual({ amount: 0, currency: 'USD' })
  })

  it('normalizes negative zero to positive zero', () => {
    expect(Object.is(money(-0, 'EUR').amount, 0)).toBe(true)
    expect(Object.is(negate(money(0, 'EUR')).amount, 0)).toBe(true)
    expect(Object.is(multiply(money(0, 'EUR'), 5).amount, 0)).toBe(true)
  })
})

describe('exact arithmetic', () => {
  it('adds and subtracts same-currency amounts exactly', () => {
    expect(add(fromDecimal(0.1, 'EUR'), fromDecimal(0.2, 'EUR'))).toEqual(
      fromDecimal(0.3, 'EUR')
    )
    expect(subtract(money(500, 'EUR'), money(150, 'EUR'))).toEqual(
      money(350, 'EUR')
    )
  })

  it('throws CurrencyMismatchError when currencies differ', () => {
    expect(() => add(money(1, 'EUR'), money(1, 'USD'))).toThrow(
      CurrencyMismatchError
    )
    expect(() => subtract(money(1, 'EUR'), money(1, 'USD'))).toThrow(
      CurrencyMismatchError
    )
  })

  it('negate and abs', () => {
    expect(negate(money(250, 'EUR'))).toEqual(money(-250, 'EUR'))
    expect(abs(money(-250, 'EUR'))).toEqual(money(250, 'EUR'))
    expect(abs(money(250, 'EUR'))).toEqual(money(250, 'EUR'))
  })
})

describe('rounded arithmetic (half-up, away from zero)', () => {
  it('multiply rounds half away from zero', () => {
    expect(multiply(money(100, 'EUR'), 1.5)).toEqual(money(150, 'EUR'))
    expect(multiply(money(5, 'EUR'), 0.5)).toEqual(money(3, 'EUR')) // 2.5 -> 3
    expect(multiply(money(-5, 'EUR'), 0.5)).toEqual(money(-3, 'EUR')) // -2.5 -> -3
  })

  it('convert applies a rate, rounds, and changes currency', () => {
    expect(convert(money(1000, 'EUR'), 'USD', 1.1)).toEqual(money(1100, 'USD'))
    expect(convert(money(5, 'EUR'), 'USD', 0.5)).toEqual(money(3, 'USD')) // 2.5 -> 3
    expect(convert(money(-5, 'EUR'), 'USD', 0.5)).toEqual(money(-3, 'USD')) // -2.5 -> -3 (half-up away from zero)
  })

  it('convert validates the target currency', () => {
    expect(() => convert(money(1, 'EUR'), 'usd', 1)).toThrow(
      InvalidCurrencyError
    )
  })

  it('multiply and convert reject non-finite factors/rates', () => {
    expect(() => multiply(money(100, 'EUR'), Number.POSITIVE_INFINITY)).toThrow(
      InvalidAmountError
    )
    expect(() => multiply(money(100, 'EUR'), Number.NaN)).toThrow(
      InvalidAmountError
    )
    expect(() =>
      convert(money(100, 'EUR'), 'USD', Number.POSITIVE_INFINITY)
    ).toThrow(InvalidAmountError)
    expect(() => convert(money(100, 'EUR'), 'USD', Number.NaN)).toThrow(
      InvalidAmountError
    )
  })
})

describe('comparison', () => {
  it('equals is total across currencies (false, never throws)', () => {
    expect(equals(money(1, 'EUR'), money(1, 'EUR'))).toBe(true)
    expect(equals(money(1, 'EUR'), money(1, 'USD'))).toBe(false)
    expect(equals(money(1, 'EUR'), money(2, 'EUR'))).toBe(false)
  })

  it('compare orders same-currency amounts', () => {
    expect(compare(money(1, 'EUR'), money(2, 'EUR'))).toBe(-1)
    expect(compare(money(2, 'EUR'), money(2, 'EUR'))).toBe(0)
    expect(compare(money(3, 'EUR'), money(2, 'EUR'))).toBe(1)
  })

  it('ordering throws on currency mismatch', () => {
    expect(() => compare(money(1, 'EUR'), money(1, 'USD'))).toThrow(
      CurrencyMismatchError
    )
    expect(() => greaterThan(money(1, 'EUR'), money(1, 'USD'))).toThrow(
      CurrencyMismatchError
    )
    expect(() => lessThan(money(1, 'EUR'), money(1, 'USD'))).toThrow(
      CurrencyMismatchError
    )
  })

  it('greaterThan / lessThan', () => {
    expect(greaterThan(money(2, 'EUR'), money(1, 'EUR'))).toBe(true)
    expect(lessThan(money(1, 'EUR'), money(2, 'EUR'))).toBe(true)
    expect(greaterThan(money(1, 'EUR'), money(1, 'EUR'))).toBe(false)
  })

  it('sign predicates', () => {
    expect(isZero(zero('EUR'))).toBe(true)
    expect(isPositive(money(1, 'EUR'))).toBe(true)
    expect(isNegative(money(-1, 'EUR'))).toBe(true)
    expect(isPositive(zero('EUR'))).toBe(false)
    expect(isNegative(zero('EUR'))).toBe(false)
  })
})

describe('allocate', () => {
  it('splits evenly when divisible', () => {
    expect(allocate(money(100, 'EUR'), [1, 1, 1, 1])).toEqual([
      money(25, 'EUR'),
      money(25, 'EUR'),
      money(25, 'EUR'),
      money(25, 'EUR'),
    ])
  })

  it('distributes the remainder by largest fractional part, summing exactly', () => {
    const parts = allocate(money(100, 'EUR'), [1, 1, 1]) // 100 / 3
    expect(parts.map((p) => p.amount)).toEqual([34, 33, 33])
    expect(parts.reduce((s, p) => s + p.amount, 0)).toBe(100)
  })

  it('respects weights and conserves the total', () => {
    const parts = allocate(money(1000, 'EUR'), [1, 2, 3]) // 166.6.., 333.3.., 500
    expect(parts.reduce((s, p) => s + p.amount, 0)).toBe(1000)
    expect(parts.map((p) => p.amount)).toEqual([167, 333, 500])
  })

  it('handles negative totals and conserves them', () => {
    const parts = allocate(money(-100, 'EUR'), [1, 1, 1])
    expect(parts.reduce((s, p) => s + p.amount, 0)).toBe(-100)
  })

  it('rejects empty, all-zero, or negative weights', () => {
    expect(() => allocate(money(100, 'EUR'), [])).toThrow()
    expect(() => allocate(money(100, 'EUR'), [0, 0])).toThrow()
    expect(() => allocate(money(100, 'EUR'), [1, -1])).toThrow()
  })
})

describe('errors', () => {
  it('InvalidAmountError carries a stable name and mentions the value', () => {
    const err = new InvalidAmountError(1.5)
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('InvalidAmountError')
    expect(err.message).toContain('1.5')
  })

  it('InvalidCurrencyError carries a stable name and mentions the value', () => {
    const err = new InvalidCurrencyError('eur')
    expect(err.name).toBe('InvalidCurrencyError')
    expect(err.message).toContain('eur')
  })

  it('CurrencyMismatchError exposes both offending codes', () => {
    const err = new CurrencyMismatchError('EUR', 'USD')
    expect(err.name).toBe('CurrencyMismatchError')
    expect(err.a).toBe('EUR')
    expect(err.b).toBe('USD')
    expect(err.message).toContain('EUR')
    expect(err.message).toContain('USD')
  })
})
