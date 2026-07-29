import 'server-only'
import {
  aggregatePortfolio,
  annualizedRentCents,
  type CurrencyTotals,
  cashFlowCents,
  costBasisCents,
  equityCents,
  grossYieldPct,
  ltvPct,
  netYieldPct,
  outstandingDebtCents,
  type PropertyExpenseEvent,
  type PropertyLoanSnapshot,
  type RentalIncomeEvent,
  roiPct,
} from '@finova/domain/real-estate/metrics'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import {
  type PropertyExpenseRow,
  type PropertyLoanRow,
  type PropertyRow,
  type PropertyValuationRow,
  propertyExpenseRowSchema,
  propertyLoanRowSchema,
  propertyRowSchema,
  propertyValuationRowSchema,
  type RentalIncomeRow,
  rentalIncomeRowSchema,
} from '@/lib/validation/real-estate'

/**
 * Read layer for the Real Estate screen. RLS-scoped user client throughout;
 * every row passes through its zod schema. Metrics are computed here from raw
 * rows via the pure domain module — nothing financial is derived in the UI.
 */

const MS_PER_DAY = 86_400_000
const DAYS_PER_YEAR = 365.25

export interface PropertyMetrics {
  annualRentCents: number
  costBasisCents: number
  debtCents: number
  equityCents: number
  grossYieldPct: number | null
  ltvPct: number | null
  monthlyCashFlowCents: number
  netYieldPct: number | null
  roiPct: number | null
  totalExpensesCents: number
  totalIncomeCents: number
}

export interface PropertyOverview {
  loans: PropertyLoanRow[]
  metrics: PropertyMetrics
  property: PropertyRow
}

export interface RealEstateOverview {
  properties: PropertyOverview[]
  totals: CurrencyTotals[]
}

export interface PropertyDetail extends PropertyOverview {
  expenses: PropertyExpenseRow[]
  incomes: RentalIncomeRow[]
  valuations: PropertyValuationRow[]
}

function isoDaysAgo(days: number, todayIso: string): string {
  const [y, m, d] = todayIso.split('-').map(Number)
  const ms = Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1) - days * MS_PER_DAY
  return new Date(ms).toISOString().slice(0, 10)
}

function computeMetrics(
  property: PropertyRow,
  loans: PropertyLoanRow[],
  incomes: RentalIncomeRow[],
  expenses: PropertyExpenseRow[],
  todayIso: string
): PropertyMetrics {
  const p = {
    currency: property.currency,
    currentValueCents: property.current_value_cents,
    isSold: property.is_sold,
    ownershipPct: property.ownership_pct,
    purchaseDate: property.purchase_date,
    purchaseFeesCents: property.purchase_fees_cents,
    purchasePriceCents: property.purchase_price_cents,
    soldFeesCents: property.sold_fees_cents,
    soldPriceCents: property.sold_price_cents,
  }
  const loanSnapshots = loans.map((l) => ({
    currency: l.currency,
    isPaidOff: l.is_paid_off,
    monthlyPaymentCents: l.monthly_payment_cents,
    outstandingCents: l.outstanding_cents,
  }))
  const incomeEvents = incomes.map((i) => ({
    amountCents: i.amount_cents,
    currency: i.currency,
    isPaid: i.is_paid,
    periodEnd: i.period_end,
    periodStart: i.period_start,
  }))
  const expenseEvents = expenses.map((e) => ({
    amountCents: e.amount_cents,
    category: e.category,
    currency: e.currency,
    expenseDate: e.expense_date,
  }))

  const totalIncomeCents = incomeEvents
    .filter((i) => i.isPaid)
    .reduce((sum, i) => sum + i.amountCents, 0)
  const totalExpensesCents = expenseEvents.reduce(
    (sum, e) => sum + e.amountCents,
    0
  )
  const annualRent = annualizedRentCents(incomeEvents, todayIso)
  const yearAgoIso = isoDaysAgo(365, todayIso)
  const operatingExpensesYearCents = expenseEvents
    .filter(
      (e) =>
        e.category !== 'mortgage_payment' &&
        e.expenseDate >= yearAgoIso &&
        e.expenseDate <= todayIso
    )
    .reduce((sum, e) => sum + e.amountCents, 0)
  const trailingYearCashFlow = cashFlowCents(
    incomeEvents,
    expenseEvents,
    loanSnapshots,
    yearAgoIso,
    todayIso
  )

  return {
    annualRentCents: annualRent,
    costBasisCents: costBasisCents(p),
    debtCents: outstandingDebtCents(loanSnapshots, p.currency),
    equityCents: equityCents(p, loanSnapshots),
    grossYieldPct: grossYieldPct(p, annualRent),
    ltvPct: ltvPct(p, loanSnapshots),
    monthlyCashFlowCents: Math.round(trailingYearCashFlow / 12),
    netYieldPct: netYieldPct(p, annualRent, operatingExpensesYearCents),
    roiPct: roiPct(p, totalIncomeCents, totalExpensesCents),
    totalExpensesCents,
    totalIncomeCents,
  }
}

async function fetchAll(table: string, orderBy: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order(orderBy, { ascending: false })
  if (error) {
    throw new Error(error.message)
  }
  return data ?? []
}

/** Every property with its loans and computed metrics, plus currency totals. */
export async function getRealEstateOverview(): Promise<RealEstateOverview> {
  await requireUser()
  const todayIso = new Date().toISOString().slice(0, 10)

  const [propertyRows, loanRows, incomeRows, expenseRows] = await Promise.all([
    fetchAll('properties', 'purchase_date'),
    fetchAll('property_loans', 'start_date'),
    fetchAll('rental_income', 'period_start'),
    fetchAll('property_expenses', 'expense_date'),
  ])
  const properties = propertyRowSchema.array().parse(propertyRows)
  const loans = propertyLoanRowSchema.array().parse(loanRows)
  const incomes = rentalIncomeRowSchema.array().parse(incomeRows)
  const expenses = propertyExpenseRowSchema.array().parse(expenseRows)

  const overviews = properties.map((property) => {
    const propertyLoans = loans.filter((l) => l.property_id === property.id)
    const metrics = computeMetrics(
      property,
      propertyLoans,
      incomes.filter((i) => i.property_id === property.id),
      expenses.filter((e) => e.property_id === property.id),
      todayIso
    )
    return { loans: propertyLoans, metrics, property }
  })

  const totals = aggregatePortfolio(
    overviews.map(({ property, loans: propertyLoans, metrics }) => ({
      loans: propertyLoans.map((l) => ({
        currency: l.currency,
        isPaidOff: l.is_paid_off,
        monthlyPaymentCents: l.monthly_payment_cents,
        outstandingCents: l.outstanding_cents,
      })),
      property: {
        currency: property.currency,
        currentValueCents: property.current_value_cents,
        isSold: property.is_sold,
        ownershipPct: property.ownership_pct,
        purchaseDate: property.purchase_date,
        purchaseFeesCents: property.purchase_fees_cents,
        purchasePriceCents: property.purchase_price_cents,
        soldFeesCents: property.sold_fees_cents,
        soldPriceCents: property.sold_price_cents,
      },
      totalExpensesCents: metrics.totalExpensesCents,
      totalIncomeCents: metrics.totalIncomeCents,
    }))
  )

  return { properties: overviews, totals }
}

/** One property with everything attached, or null when not visible. */
export async function getPropertyDetail(
  id: string
): Promise<PropertyDetail | null> {
  await requireUser()
  const supabase = await createClient()
  const todayIso = new Date().toISOString().slice(0, 10)

  const { data: propertyRow, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    throw new Error(error.message)
  }
  if (!propertyRow) {
    return null
  }
  const property = propertyRowSchema.parse(propertyRow)

  async function children(table: string, orderBy: string) {
    const { data, error: childError } = await supabase
      .from(table)
      .select('*')
      .eq('property_id', id)
      .order(orderBy, { ascending: false })
    if (childError) {
      throw new Error(childError.message)
    }
    return data ?? []
  }
  const [loanRows, incomeRows, expenseRows, valuationRows] = await Promise.all([
    children('property_loans', 'start_date'),
    children('rental_income', 'period_start'),
    children('property_expenses', 'expense_date'),
    children('property_valuations', 'valuation_date'),
  ])
  const loans = propertyLoanRowSchema.array().parse(loanRows)
  const incomes = rentalIncomeRowSchema.array().parse(incomeRows)
  const expenses = propertyExpenseRowSchema.array().parse(expenseRows)
  const valuations = propertyValuationRowSchema.array().parse(valuationRows)

  return {
    expenses,
    incomes,
    loans,
    metrics: computeMetrics(property, loans, incomes, expenses, todayIso),
    property,
    valuations,
  }
}

/**
 * Portfolio equity per currency (unsold properties), for the main dashboard
 * wealth rollup. Cheap: two selects, no per-property metrics.
 */
export async function getRealEstateEquityByCurrency(): Promise<
  { currency: string; equityCents: number }[]
> {
  await requireUser()
  const supabase = await createClient()
  const [{ data: props, error: pErr }, { data: loans, error: lErr }] =
    await Promise.all([
      supabase
        .from('properties')
        .select('id, currency, current_value_cents, ownership_pct, is_sold'),
      supabase
        .from('property_loans')
        .select('property_id, currency, outstanding_cents, is_paid_off'),
    ])
  if (pErr) {
    throw new Error(pErr.message)
  }
  if (lErr) {
    throw new Error(lErr.message)
  }

  const active = (props ?? []).filter((p) => !p.is_sold)
  const pctById = new Map(
    active.map((p) => [String(p.id), Number(p.ownership_pct)])
  )
  const byCurrency = new Map<string, number>()
  for (const p of active) {
    const ccy = String(p.currency)
    const share = Number(p.ownership_pct) / 100
    byCurrency.set(
      ccy,
      (byCurrency.get(ccy) ?? 0) +
        Math.round(Number(p.current_value_cents) * share)
    )
  }
  for (const l of loans ?? []) {
    const pct = pctById.get(String(l.property_id))
    if (l.is_paid_off || pct === undefined) {
      continue
    }
    const ccy = String(l.currency)
    byCurrency.set(
      ccy,
      (byCurrency.get(ccy) ?? 0) -
        Math.round(Number(l.outstanding_cents) * (pct / 100))
    )
  }
  return [...byCurrency.entries()].map(([currency, cents]) => ({
    currency,
    equityCents: cents,
  }))
}

/**
 * Every paid rental-income row, in native currency — feeds
 * incomeInRangeCents() so the dashboard can fold rent into earnings for a
 * given period. Rows span arbitrary date ranges (a lease can cover months a
 * discrete "date" wouldn't capture), so callers must prorate by day overlap
 * rather than matching a single date, same as the Real Estate page's own
 * cash-flow and annualized-rent figures. Never converted across currencies
 * (properties don't share a portfolio base currency).
 */
export async function getRentalIncomeEvents(): Promise<RentalIncomeEvent[]> {
  await requireUser()
  const supabase = await createClient()
  const [{ data, error }, pctById] = await Promise.all([
    supabase
      .from('rental_income')
      .select('amount_cents, currency, period_start, period_end, property_id')
      .eq('is_paid', true),
    getOwnershipPctById(),
  ])
  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []).map((r) => ({
    amountCents: Math.round(
      Number(r.amount_cents) * shareOf(pctById, r.property_id)
    ),
    currency: String(r.currency),
    isPaid: true,
    periodEnd: String(r.period_end),
    periodStart: String(r.period_start),
  }))
}

/**
 * Every property-expense row, in native currency — feeds cashFlowCents() so
 * the dashboard can net rent against costs (mortgage, maintenance, …) for a
 * given period, same as the Real Estate page's own cash-flow figure.
 */
export async function getPropertyExpenseEvents(): Promise<
  PropertyExpenseEvent[]
> {
  await requireUser()
  const supabase = await createClient()
  const [{ data, error }, pctById] = await Promise.all([
    supabase
      .from('property_expenses')
      .select('amount_cents, category, currency, expense_date, property_id'),
    getOwnershipPctById(),
  ])
  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []).map((r) => ({
    amountCents: Math.round(
      Number(r.amount_cents) * shareOf(pctById, r.property_id)
    ),
    category: String(r.category),
    currency: String(r.currency),
    expenseDate: String(r.expense_date),
  }))
}

/**
 * Every property-loan row, in native currency — feeds cashFlowCents() so
 * scheduled mortgage payments count against rent the same way the Real
 * Estate page's own cash-flow figure does.
 */
export async function getPropertyLoanSnapshots(): Promise<
  PropertyLoanSnapshot[]
> {
  await requireUser()
  const supabase = await createClient()
  const [{ data, error }, pctById] = await Promise.all([
    supabase
      .from('property_loans')
      .select(
        'currency, is_paid_off, monthly_payment_cents, outstanding_cents, property_id'
      ),
    getOwnershipPctById(),
  ])
  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []).map((r) => {
    const share = shareOf(pctById, r.property_id)
    return {
      currency: String(r.currency),
      isPaidOff: Boolean(r.is_paid_off),
      monthlyPaymentCents: Math.round(Number(r.monthly_payment_cents) * share),
      outstandingCents: Math.round(Number(r.outstanding_cents) * share),
    }
  })
}

/** `property_id → ownership_pct` map, for scaling cross-property event rows. */
async function getOwnershipPctById(): Promise<Map<string, number>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('properties')
    .select('id, ownership_pct')
  if (error) {
    throw new Error(error.message)
  }
  return new Map(
    (data ?? []).map((p) => [String(p.id), Number(p.ownership_pct)])
  )
}

/** Ownership share (0..1) for a property_id, defaulting to fully owned. */
function shareOf(pctById: Map<string, number>, propertyId: unknown): number {
  return (pctById.get(String(propertyId)) ?? 100) / 100
}

/** Rough day/month figures derived from an annual amount. */
export function rentBreakdown(annualCents: number): {
  perDayCents: number
  perMonthCents: number
  perYearCents: number
} {
  return {
    perDayCents: Math.round(annualCents / DAYS_PER_YEAR),
    perMonthCents: Math.round(annualCents / 12),
    perYearCents: annualCents,
  }
}
