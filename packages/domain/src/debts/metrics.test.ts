import { describe, expect, it } from 'vitest'
import {
  aggregateDebts,
  amortizationSchedule,
  type DebtSnapshot,
  nextPaymentDate,
  payoffDate,
  projectedBalanceCents,
} from './metrics'

describe('amortizationSchedule', () => {
  it('fully amortizes a zero-interest loan evenly', () => {
    const rows = amortizationSchedule({
      interestRatePct: 0,
      paymentCents: 10_00,
      principalCents: 120_00,
      startDate: '2026-01-01',
      termMonths: 12,
    })
    expect(rows).toHaveLength(12)
    expect(rows.every((r) => r.interestCents === 0)).toBe(true)
    expect(rows.at(-1)?.balanceCents).toBe(0)
  })

  it('pays off in a single payment for a 1-month term', () => {
    const rows = amortizationSchedule({
      interestRatePct: 0,
      paymentCents: 100_00,
      principalCents: 100_00,
      startDate: '2026-01-01',
      termMonths: 1,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.balanceCents).toBe(0)
  })

  it('splits payment into interest and principal for a standard loan', () => {
    const rows = amortizationSchedule({
      interestRatePct: 12,
      paymentCents: 1000_00,
      principalCents: 100_000_00,
      startDate: '2026-01-01',
      termMonths: 360,
    })
    const first = rows[0]
    expect(first?.interestCents).toBe(100_000_00 * 0.01)
    expect(first?.principalCents).toBe(1000_00 - 100_000_00 * 0.01)
    expect(first?.paymentDate).toBe('2026-02-01')
  })

  it('clamps the final payment so the balance never goes negative', () => {
    const rows = amortizationSchedule({
      interestRatePct: 0,
      paymentCents: 40_00,
      principalCents: 100_00,
      startDate: '2026-01-01',
      termMonths: 10,
    })
    expect(rows.every((r) => r.balanceCents >= 0)).toBe(true)
    expect(rows.at(-1)?.balanceCents).toBe(0)
    // Pays off in 3 months (40+40+20), not the full 10-month term.
    expect(rows).toHaveLength(3)
  })
})

describe('projectedBalanceCents', () => {
  const debt = {
    interestRatePct: 0,
    paymentCents: 10_00,
    principalCents: 120_00,
    startDate: '2026-01-01',
    termMonths: 12,
  }

  it('returns the full principal before the first payment', () => {
    expect(projectedBalanceCents(debt, '2026-01-01')).toBe(120_00)
  })

  it('returns the remaining balance partway through the schedule', () => {
    expect(projectedBalanceCents(debt, '2026-06-01')).toBe(70_00)
  })

  it('returns 0 once the term completes', () => {
    expect(projectedBalanceCents(debt, '2027-06-01')).toBe(0)
  })
})

describe('nextPaymentDate / payoffDate', () => {
  const debt = {
    interestRatePct: 0,
    paymentCents: 10_00,
    principalCents: 120_00,
    startDate: '2026-01-01',
    termMonths: 12,
  }

  it('finds the next scheduled payment on/after a given date', () => {
    expect(nextPaymentDate(debt, '2026-03-15')).toBe('2026-04-01')
  })

  it('returns null once every payment is in the past', () => {
    expect(nextPaymentDate(debt, '2028-01-01')).toBeNull()
  })

  it('returns the date the balance reaches 0', () => {
    expect(payoffDate(debt)).toBe('2027-01-01')
  })

  it('returns null when the term ends without a 0 balance', () => {
    expect(
      payoffDate({
        interestRatePct: 20,
        paymentCents: 1_00,
        principalCents: 1000_00,
        startDate: '2026-01-01',
        termMonths: 6,
      })
    ).toBeNull()
  })
})

describe('aggregateDebts', () => {
  function debt(overrides: Partial<DebtSnapshot> = {}): DebtSnapshot {
    return {
      currency: 'EUR',
      outstandingCents: 100_00,
      status: 'active',
      type: 'personal_loan',
      ...overrides,
    }
  }

  it('sums outstanding balances per currency and type', () => {
    const totals = aggregateDebts([
      debt({ type: 'mortgage', outstandingCents: 200_000_00 }),
      debt({ type: 'car_loan', outstandingCents: 15_000_00 }),
      debt({ type: 'car_loan', outstandingCents: 5_000_00 }),
    ])
    expect(totals).toHaveLength(1)
    expect(totals[0]?.totalOutstandingCents).toBe(220_000_00)
    expect(totals[0]?.outstandingByType.mortgage).toBe(200_000_00)
    expect(totals[0]?.outstandingByType.car_loan).toBe(20_000_00)
    expect(totals[0]?.debtCount).toBe(3)
  })

  it('excludes paid-off debts', () => {
    const totals = aggregateDebts([
      debt({ status: 'paid_off', outstandingCents: 0 }),
      debt({ outstandingCents: 50_00 }),
    ])
    expect(totals[0]?.totalOutstandingCents).toBe(50_00)
    expect(totals[0]?.debtCount).toBe(1)
  })

  it('keeps currencies separate', () => {
    const totals = aggregateDebts([
      debt({ currency: 'EUR', outstandingCents: 100_00 }),
      debt({ currency: 'USD', outstandingCents: 200_00 }),
    ])
    expect(totals).toHaveLength(2)
  })
})
