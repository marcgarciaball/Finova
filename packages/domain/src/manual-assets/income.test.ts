import { describe, expect, it } from 'vitest'
import { incomeInRangeCents, type ManualAssetIncomeEvent } from './income'

function event(overrides: Partial<ManualAssetIncomeEvent> = {}) {
  return {
    amountCents: 10_00,
    receivedDate: '2026-07-15',
    ...overrides,
  }
}

describe('incomeInRangeCents', () => {
  it('sums events within the range', () => {
    const total = incomeInRangeCents(
      [event({ amountCents: 5_00 }), event({ amountCents: 3_00 })],
      '2026-07-01',
      '2026-07-31'
    )
    expect(total).toBe(8_00)
  })

  it('excludes events outside the range', () => {
    const total = incomeInRangeCents(
      [
        event({ amountCents: 5_00, receivedDate: '2026-06-30' }),
        event({ amountCents: 3_00, receivedDate: '2026-08-01' }),
      ],
      '2026-07-01',
      '2026-07-31'
    )
    expect(total).toBe(0)
  })

  it('includes events on the boundary dates', () => {
    const total = incomeInRangeCents(
      [
        event({ amountCents: 5_00, receivedDate: '2026-07-01' }),
        event({ amountCents: 3_00, receivedDate: '2026-07-31' }),
      ],
      '2026-07-01',
      '2026-07-31'
    )
    expect(total).toBe(8_00)
  })

  it('returns 0 for no events', () => {
    expect(incomeInRangeCents([], '2026-07-01', '2026-07-31')).toBe(0)
  })
})
