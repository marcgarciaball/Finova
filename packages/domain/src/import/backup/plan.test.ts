import { describe, expect, it } from 'vitest'
import type { DebtRow } from '@/lib/validation/debts'
import type { PropertyRow, RentalIncomeRow } from '@/lib/validation/real-estate'
import type { RealEstateExportInput } from '../../export/bundle'
import { loanFingerprint, propertyFingerprint } from './fingerprint'
import { type ExistingRealEstate, planRealEstateImport } from './plan'

const property = (over: Partial<PropertyRow> = {}): PropertyRow => ({
  id: 'export-pr1',
  user_id: 'exporter',
  name: 'Piso Xirivella',
  type: 'investment',
  address: null,
  city: 'Xirivella',
  country: 'ES',
  currency: 'EUR',
  purchase_date: '2020-01-15',
  purchase_price_cents: 12_000_000,
  transfer_tax_cents: 500_000,
  notary_cents: 0,
  registry_cents: 0,
  agency_fee_cents: 0,
  renovation_cost_cents: 0,
  other_purchase_costs_cents: 0,
  current_value_cents: 15_000_000,
  last_valued_at: '2026-01-01',
  is_rented: true,
  rental_start_date: '2021-01-01',
  rental_end_date: null,
  is_sold: false,
  sold_date: null,
  sold_price_cents: null,
  sold_fees_cents: null,
  notes: null,
  created_at: '2020-01-15T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
})

const loan = (over: Partial<DebtRow> = {}): DebtRow => ({
  id: 'export-l1',
  user_id: 'exporter',
  type: 'mortgage',
  property_id: 'export-pr1',
  lender: 'BBVA',
  currency: 'EUR',
  principal_cents: 9_000_000,
  outstanding_cents: 6_000_000,
  interest_rate_pct: 2.5,
  rate_type: 'fixed',
  term_months: 240,
  start_date: '2020-02-01',
  payment_cents: 45_000,
  status: 'active',
  notes: null,
  created_at: '2020-02-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
})

const income = (over: Partial<RentalIncomeRow> = {}): RentalIncomeRow => ({
  id: 'export-i1',
  user_id: 'exporter',
  property_id: 'export-pr1',
  period_start: '2026-01-01',
  period_end: '2026-01-31',
  amount_cents: 90_000,
  currency: 'EUR',
  tenant_name: null,
  is_paid: true,
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
  ...over,
})

const emptyExisting = (): ExistingRealEstate => ({
  propertyIdByFp: new Map(),
  childFps: new Set(),
})

const input = (
  over: Partial<RealEstateExportInput> = {}
): RealEstateExportInput => ({
  properties: [property()],
  loans: [loan()],
  valuations: [],
  income: [income()],
  expenses: [],
  ...over,
})

describe('planRealEstateImport', () => {
  it('marks everything new against an empty account', () => {
    const plan = planRealEstateImport(input(), emptyExisting())
    expect(plan.counts.properties).toEqual({ new: 1, duplicate: 0, error: 0 })
    expect(plan.counts.loans.new).toBe(1)
    expect(plan.counts.income.new).toBe(1)
    expect(plan.properties[0].status).toBe('new')
    expect(plan.loans).toHaveLength(1)
  })

  it('links children to their parent by fingerprint, not id', () => {
    const plan = planRealEstateImport(input(), emptyExisting())
    expect(plan.loans[0].parentFp).toBe(propertyFingerprint(property()))
  })

  it('skips rows that already exist (idempotent re-import)', () => {
    const p = property()
    const pFp = propertyFingerprint(p)
    const existing: ExistingRealEstate = {
      propertyIdByFp: new Map([[pFp, 'db-pr1']]),
      childFps: new Set([
        loanFingerprint(pFp, loan()),
        // income fp built the same way the planner does
      ]),
    }
    const plan = planRealEstateImport(input({ income: [] }), existing)
    expect(plan.counts.properties).toEqual({ new: 0, duplicate: 1, error: 0 })
    expect(plan.counts.loans.duplicate).toBe(1)
    expect(plan.properties[0]).toMatchObject({
      status: 'duplicate',
      existingId: 'db-pr1',
    })
    expect(plan.loans).toHaveLength(0)
  })

  it('adds a new child under an already-existing property (partial merge)', () => {
    const p = property()
    const pFp = propertyFingerprint(p)
    const existing: ExistingRealEstate = {
      propertyIdByFp: new Map([[pFp, 'db-pr1']]),
      childFps: new Set([loanFingerprint(pFp, loan())]),
    }
    // A second, new loan on the same property.
    const newLoan = loan({ id: 'export-l2', lender: 'ING' })
    const plan = planRealEstateImport(
      input({ loans: [loan(), newLoan], income: [] }),
      existing
    )
    expect(plan.counts.loans).toEqual({ new: 1, duplicate: 1, error: 0 })
    expect(plan.loans[0].row.lender).toBe('ING')
    expect(plan.loans[0].parentFp).toBe(pFp)
  })

  it('counts a child whose parent is missing from the file as an error', () => {
    const orphan = loan({ property_id: 'not-in-file' })
    const plan = planRealEstateImport(
      input({ properties: [], loans: [orphan], income: [] }),
      emptyExisting()
    )
    expect(plan.counts.loans).toEqual({ new: 0, duplicate: 0, error: 1 })
    expect(plan.loans).toHaveLength(0)
  })

  it('dedupes identical rows within the same file', () => {
    const plan = planRealEstateImport(
      input({ properties: [property(), property()], loans: [], income: [] }),
      emptyExisting()
    )
    expect(plan.counts.properties.new).toBe(1)
  })
})
