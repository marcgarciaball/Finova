import { describe, expect, it } from 'vitest'
import { projectedAnnualInterestCents } from './interest'

describe('projectedAnnualInterestCents', () => {
  it('computes annual interest from balance and basis points', () => {
    expect(projectedAnnualInterestCents(10_000_00, 200)).toBe(200_00) // 2% of €10,000
  })

  it('rounds to the nearest cent', () => {
    expect(projectedAnnualInterestCents(333, 150)).toBe(5) // 333 * 0.015 = 4.995
  })

  it('returns 0 for a zero rate or zero balance', () => {
    expect(projectedAnnualInterestCents(10_000_00, 0)).toBe(0)
    expect(projectedAnnualInterestCents(0, 200)).toBe(0)
  })
})
