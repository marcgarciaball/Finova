import { describe, expect, it } from 'vitest'
import {
  createExpenseSchema,
  createLoanSchema,
  createPropertySchema,
  createRentalIncomeSchema,
  createValuationSchema,
  normalizeDecimal,
  propertyRowSchema,
} from './real-estate'

const validProperty = {
  name: 'Piso Barcelona Eixample',
  type: 'investment',
  currency: 'EUR',
  purchaseDate: '2020-01-15',
  purchasePrice: '200000',
  purchaseFees: '20000.50',
  currentValue: '250000',
}

describe('createPropertySchema', () => {
  it('accepts a minimal valid property and applies defaults', () => {
    const parsed = createPropertySchema.parse(validProperty)
    expect(parsed.country).toBe('ES')
    expect(parsed.isRented).toBe(false)
    expect(parsed.purchaseFees).toBe('20000.50')
  })

  it('accepts comma decimals', () => {
    const parsed = createPropertySchema.parse({
      ...validProperty,
      purchasePrice: '200000,99',
    })
    expect(normalizeDecimal(parsed.purchasePrice)).toBe(200_000.99)
  })

  it('rejects more than two decimal places', () => {
    expect(
      createPropertySchema.safeParse({
        ...validProperty,
        purchasePrice: '200000.999',
      }).success
    ).toBe(false)
  })

  it('rejects a rental end before its start', () => {
    const result = createPropertySchema.safeParse({
      ...validProperty,
      rentalStartDate: '2026-05-01',
      rentalEndDate: '2026-04-01',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown property type', () => {
    expect(
      createPropertySchema.safeParse({ ...validProperty, type: 'castle' })
        .success
    ).toBe(false)
  })
})

describe('createLoanSchema', () => {
  const validLoan = {
    propertyId: '4c9f1a52-4a1e-4a5a-9d3c-8a2f6b7c9d01',
    lenderName: 'Santander',
    loanType: 'mortgage',
    originalAmount: '160000',
    outstanding: '120000',
    interestRatePct: '3.250',
    rateType: 'fixed',
    startDate: '2020-01-15',
    monthlyPayment: '800',
  }

  it('accepts a valid mortgage', () => {
    expect(createLoanSchema.safeParse(validLoan).success).toBe(true)
  })

  it('accepts a comma-decimal Euribor spread', () => {
    const parsed = createLoanSchema.parse({
      ...validLoan,
      euriborSpreadPct: '0,990',
    })
    expect(parsed.euriborSpreadPct).toBe('0,990')
  })

  it('rejects an invalid rate type', () => {
    expect(
      createLoanSchema.safeParse({ ...validLoan, rateType: 'floating' }).success
    ).toBe(false)
  })
})

describe('createRentalIncomeSchema', () => {
  it('rejects a period ending before it starts', () => {
    expect(
      createRentalIncomeSchema.safeParse({
        propertyId: '4c9f1a52-4a1e-4a5a-9d3c-8a2f6b7c9d01',
        periodStart: '2026-02-01',
        periodEnd: '2026-01-01',
        amount: '1200',
      }).success
    ).toBe(false)
  })
})

describe('createExpenseSchema', () => {
  it('requires a recurrence when marked recurring', () => {
    expect(
      createExpenseSchema.safeParse({
        propertyId: '4c9f1a52-4a1e-4a5a-9d3c-8a2f6b7c9d01',
        category: 'community_fee',
        description: 'Comunidad',
        amount: '120',
        expenseDate: '2026-01-05',
        isRecurring: true,
      }).success
    ).toBe(false)
  })
})

describe('createValuationSchema', () => {
  it('defaults the source to manual', () => {
    const parsed = createValuationSchema.parse({
      propertyId: '4c9f1a52-4a1e-4a5a-9d3c-8a2f6b7c9d01',
      valuationDate: '2026-01-01',
      value: '260000',
    })
    expect(parsed.source).toBe('manual')
  })
})

describe('propertyRowSchema', () => {
  it('parses a full database row', () => {
    const row = {
      id: '4c9f1a52-4a1e-4a5a-9d3c-8a2f6b7c9d01',
      user_id: '4c9f1a52-4a1e-4a5a-9d3c-8a2f6b7c9d02',
      name: 'Piso',
      type: 'investment',
      address: null,
      city: 'Barcelona',
      country: 'ES',
      currency: 'EUR',
      purchase_date: '2020-01-15',
      purchase_price_cents: 20_000_000,
      purchase_fees_cents: 2_000_000,
      current_value_cents: 25_000_000,
      last_valued_at: '2026-01-01',
      ownership_pct: 100,
      is_rented: true,
      rental_start_date: '2024-01-01',
      rental_end_date: null,
      is_sold: false,
      sold_date: null,
      sold_price_cents: null,
      sold_fees_cents: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
    expect(propertyRowSchema.parse(row).current_value_cents).toBe(25_000_000)
  })

  it('rejects non-integer money', () => {
    expect(
      propertyRowSchema.safeParse({
        id: 'x',
        user_id: 'y',
        name: 'Piso',
        type: 'investment',
        address: null,
        city: null,
        country: 'ES',
        currency: 'EUR',
        purchase_date: '2020-01-15',
        purchase_price_cents: 200_000.5,
        purchase_fees_cents: 0,
        current_value_cents: 0,
        last_valued_at: '2026-01-01',
        ownership_pct: 100,
        is_rented: false,
        rental_start_date: null,
        rental_end_date: null,
        is_sold: false,
        sold_date: null,
        sold_price_cents: null,
        sold_fees_cents: null,
        notes: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }).success
    ).toBe(false)
  })
})
