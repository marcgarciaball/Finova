import { describe, expect, it } from 'vitest'
import { reconciliationDelta } from './reconcile'

describe('reconciliationDelta', () => {
  it('is positive when the real balance is higher (missing income)', () => {
    expect(reconciliationDelta(10_000, 12_500)).toBe(2_500)
  })

  it('is negative when the real balance is lower (missing expense)', () => {
    expect(reconciliationDelta(10_000, 8_000)).toBe(-2_000)
  })

  it('is zero when already balanced', () => {
    expect(reconciliationDelta(10_000, 10_000)).toBe(0)
  })

  it('handles a negative current balance', () => {
    expect(reconciliationDelta(-5_000, 0)).toBe(5_000)
  })
})
