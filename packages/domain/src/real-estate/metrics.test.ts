import { describe, expect, it } from 'vitest'
import {
  aggregatePortfolio,
  annualizedRentCents,
  cashFlowCents,
  costBasisCents,
  equityCents,
  grossYieldPct,
  incomeInRangeCents,
  ltvPct,
  MixedCurrencyError,
  monthsInPeriod,
  netYieldPct,
  outstandingDebtCents,
  type PropertyExpenseEvent,
  type PropertyLoanSnapshot,
  type PropertySnapshot,
  type RentalIncomeEvent,
  roiPct,
  totalFromMonthlyRentCents,
} from './metrics'

function property(overrides: Partial<PropertySnapshot> = {}): PropertySnapshot {
  return {
    currency: 'EUR',
    purchaseDate: '2020-01-15',
    purchasePriceCents: 20_000_000, // 200 000 €
    purchaseFeesCents: 2_000_000, // 20 000 €
    currentValueCents: 25_000_000, // 250 000 €
    ownershipPct: 100,
    isSold: false,
    soldPriceCents: null,
    soldFeesCents: null,
    ...overrides,
  }
}

function loan(
  overrides: Partial<PropertyLoanSnapshot> = {}
): PropertyLoanSnapshot {
  return {
    currency: 'EUR',
    outstandingCents: 12_000_000, // 120 000 €
    monthlyPaymentCents: 80_000, // 800 €
    isPaidOff: false,
    ...overrides,
  }
}

function income(overrides: Partial<RentalIncomeEvent> = {}): RentalIncomeEvent {
  return {
    amountCents: 120_000, // 1 200 €
    currency: 'EUR',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    isPaid: true,
    ...overrides,
  }
}

function expense(
  overrides: Partial<PropertyExpenseEvent> = {}
): PropertyExpenseEvent {
  return {
    amountCents: 45_000, // 450 €
    currency: 'EUR',
    expenseDate: '2026-01-10',
    category: 'property_tax',
    ...overrides,
  }
}

describe('costBasisCents', () => {
  it('is purchase price plus purchase fees', () => {
    expect(costBasisCents(property())).toBe(22_000_000)
  })
})

describe('outstandingDebtCents', () => {
  it('sums active loans and skips paid-off ones', () => {
    expect(
      outstandingDebtCents(
        [
          loan(),
          loan({ outstandingCents: 3_000_000 }),
          loan({ outstandingCents: 5_000_000, isPaidOff: true }),
        ],
        'EUR'
      )
    ).toBe(15_000_000)
  })

  it('is zero with no loans', () => {
    expect(outstandingDebtCents([], 'EUR')).toBe(0)
  })

  it('throws on a loan in another currency', () => {
    expect(() =>
      outstandingDebtCents([loan({ currency: 'USD' })], 'EUR')
    ).toThrow(MixedCurrencyError)
  })
})

describe('equityCents', () => {
  it('is current value minus outstanding debt', () => {
    expect(equityCents(property(), [loan()])).toBe(13_000_000)
  })

  it('can be negative when underwater', () => {
    expect(
      equityCents(property({ currentValueCents: 10_000_000 }), [loan()])
    ).toBe(-2_000_000)
  })

  it('scales by ownership share for a co-owned property', () => {
    expect(equityCents(property({ ownershipPct: 50 }), [loan()])).toBe(
      6_500_000
    )
  })
})

describe('ltvPct', () => {
  it('is outstanding debt over current value, in percent', () => {
    expect(ltvPct(property(), [loan()])).toBeCloseTo(48, 5)
  })

  it('is null when the property has no value', () => {
    expect(ltvPct(property({ currentValueCents: 0 }), [loan()])).toBeNull()
  })

  it('is 0 with no active loans', () => {
    expect(ltvPct(property(), [])).toBe(0)
  })
})

describe('incomeInRangeCents', () => {
  it('counts paid income fully inside the range', () => {
    expect(incomeInRangeCents([income()], '2026-01-01', '2026-12-31')).toBe(
      120_000
    )
  })

  it('ignores unpaid income', () => {
    expect(
      incomeInRangeCents(
        [income({ isPaid: false })],
        '2026-01-01',
        '2026-12-31'
      )
    ).toBe(0)
  })

  it('prorates a period straddling the range boundary by days', () => {
    // 31-day period, 16 days (Jan 16–31) inside the range
    const result = incomeInRangeCents([income()], '2026-01-16', '2026-12-31')
    expect(result).toBe(Math.round((120_000 * 16) / 31))
  })

  it('ignores income entirely outside the range', () => {
    expect(incomeInRangeCents([income()], '2026-02-01', '2026-12-31')).toBe(0)
  })
})

describe('annualizedRentCents', () => {
  it('extrapolates the average daily rent to a full year', () => {
    // 1 200 € over the 31 days of January → daily ≈ 3 870.97 c
    const result = annualizedRentCents([income()], '2026-01-31')
    expect(result).toBe(Math.round((120_000 / 31) * 365.25))
  })

  it('is 0 with no paid income', () => {
    expect(annualizedRentCents([], '2026-01-31')).toBe(0)
    expect(annualizedRentCents([income({ isPaid: false })], '2026-01-31')).toBe(
      0
    )
  })
})

describe('grossYieldPct / netYieldPct', () => {
  it('gross yield is annual rent over cost basis', () => {
    // 14 400 € / 220 000 € ≈ 6.545%
    expect(grossYieldPct(property(), 1_440_000)).toBeCloseTo(6.5454, 3)
  })

  it('net yield deducts annual operating expenses', () => {
    // (14 400 − 2 400) / 220 000 ≈ 5.4545%
    expect(netYieldPct(property(), 1_440_000, 240_000)).toBeCloseTo(5.4545, 3)
  })

  it('yields are null when cost basis is zero', () => {
    const free = property({ purchasePriceCents: 0, purchaseFeesCents: 0 })
    expect(grossYieldPct(free, 1_440_000)).toBeNull()
    expect(netYieldPct(free, 1_440_000, 0)).toBeNull()
  })
})

describe('cashFlowCents', () => {
  it('is income minus expenses minus scheduled loan payments', () => {
    // Jan 2026: 1 200 rent − 450 IBI − 800 mortgage = −50 €
    const result = cashFlowCents(
      [income()],
      [expense()],
      [loan()],
      '2026-01-01',
      '2026-01-31'
    )
    expect(result).toBe(120_000 - 45_000 - 80_000)
  })

  it('excludes mortgage_payment expense rows to avoid double counting loans', () => {
    const result = cashFlowCents(
      [income()],
      [expense({ category: 'mortgage_payment', amountCents: 80_000 })],
      [loan()],
      '2026-01-01',
      '2026-01-31'
    )
    expect(result).toBe(120_000 - 80_000)
  })

  it('skips paid-off loans and out-of-range expenses', () => {
    const result = cashFlowCents(
      [income()],
      [expense({ expenseDate: '2025-12-20' })],
      [loan({ isPaidOff: true })],
      '2026-01-01',
      '2026-01-31'
    )
    expect(result).toBe(120_000)
  })
})

describe('roiPct', () => {
  it('combines capital gain and net rental profit over cost basis', () => {
    // gain 30 000 + net rental (14 400 − 2 400) = 42 000 over 220 000 ≈ 19.09%
    expect(roiPct(property(), 1_440_000, 240_000)).toBeCloseTo(19.0909, 3)
  })

  it('uses sale proceeds net of fees for sold properties', () => {
    const sold = property({
      isSold: true,
      soldPriceCents: 30_000_000,
      soldFeesCents: 1_000_000,
    })
    // (29 000 000 − 22 000 000 + 0) / 22 000 000 ≈ 31.818%
    expect(roiPct(sold, 0, 0)).toBeCloseTo(31.8181, 3)
  })

  it('is null when cost basis is zero', () => {
    expect(
      roiPct(property({ purchasePriceCents: 0, purchaseFeesCents: 0 }), 0, 0)
    ).toBeNull()
  })
})

describe('monthsInPeriod', () => {
  it('counts a full calendar month as exactly 1', () => {
    expect(monthsInPeriod('2026-01-01', '2026-01-31')).toBe(1)
    expect(monthsInPeriod('2026-02-01', '2026-02-28')).toBe(1)
  })

  it('counts anchored month spans as whole months', () => {
    // 15th through the 14th of the next month = 1 month
    expect(monthsInPeriod('2026-01-15', '2026-02-14')).toBe(1)
    expect(monthsInPeriod('2026-01-15', '2026-07-14')).toBe(6)
  })

  it('prorates a partial month by its own length', () => {
    expect(monthsInPeriod('2026-01-01', '2026-01-15')).toBeCloseTo(15 / 31, 6)
    // one full month + half of February
    expect(monthsInPeriod('2026-01-01', '2026-02-14')).toBeCloseTo(
      1 + 14 / 28,
      6
    )
  })

  it('handles month-end anchors without overflowing', () => {
    // Jan 31 + 1 month clamps to Feb 28; the whole of February counts as 1
    expect(monthsInPeriod('2026-01-31', '2026-02-27')).toBeCloseTo(1, 6)
  })
})

describe('totalFromMonthlyRentCents', () => {
  it('multiplies the monthly rent by whole months', () => {
    expect(totalFromMonthlyRentCents(120_000, '2026-01-01', '2026-06-30')).toBe(
      720_000
    )
  })

  it('prorates partial months', () => {
    expect(totalFromMonthlyRentCents(120_000, '2026-01-01', '2026-01-15')).toBe(
      Math.round((120_000 * 15) / 31)
    )
  })
})

describe('aggregatePortfolio', () => {
  it('groups totals per currency and never mixes them', () => {
    const eur = {
      property: property(),
      loans: [loan()],
      totalIncomeCents: 1_440_000,
      totalExpensesCents: 240_000,
    }
    const usd = {
      property: property({ currency: 'USD', currentValueCents: 50_000_000 }),
      loans: [],
      totalIncomeCents: 0,
      totalExpensesCents: 100_000,
    }
    const result = aggregatePortfolio([eur, usd])
    expect(result).toEqual([
      {
        currency: 'EUR',
        valueCents: 25_000_000,
        debtCents: 12_000_000,
        equityCents: 13_000_000,
        costBasisCents: 22_000_000,
        incomeCents: 1_440_000,
        expensesCents: 240_000,
        netProfitCents: 1_200_000,
        propertyCount: 1,
      },
      {
        currency: 'USD',
        valueCents: 50_000_000,
        debtCents: 0,
        equityCents: 50_000_000,
        costBasisCents: 22_000_000,
        incomeCents: 0,
        expensesCents: 100_000,
        netProfitCents: -100_000,
        propertyCount: 1,
      },
    ])
  })

  it('excludes sold properties from value/debt/equity but keeps their P&L', () => {
    const sold = {
      property: property({ isSold: true, soldPriceCents: 30_000_000 }),
      loans: [],
      totalIncomeCents: 500_000,
      totalExpensesCents: 100_000,
    }
    const [totals] = aggregatePortfolio([sold])
    expect(totals?.valueCents).toBe(0)
    expect(totals?.equityCents).toBe(0)
    expect(totals?.incomeCents).toBe(500_000)
    expect(totals?.propertyCount).toBe(0)
  })

  it('scales value, debt, equity, cost basis, income and expenses by ownership share', () => {
    const halfOwned = {
      property: property({ ownershipPct: 50 }),
      loans: [loan()],
      totalIncomeCents: 1_440_000,
      totalExpensesCents: 240_000,
    }
    const [totals] = aggregatePortfolio([halfOwned])
    expect(totals).toEqual({
      currency: 'EUR',
      valueCents: 12_500_000,
      debtCents: 6_000_000,
      equityCents: 6_500_000,
      costBasisCents: 11_000_000,
      incomeCents: 720_000,
      expensesCents: 120_000,
      netProfitCents: 600_000,
      propertyCount: 1,
    })
  })
})
