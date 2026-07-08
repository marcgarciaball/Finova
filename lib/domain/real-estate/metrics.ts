/**
 * Pure real-estate portfolio math. Everything is integer cents in a single
 * currency per property; cross-currency aggregation only groups, never sums
 * (see aggregatePortfolio). Percentages are plain numbers (48 = 48%).
 *
 * Conventions:
 * - Cost basis = purchase price + purchase fees; yields and ROI are computed
 *   against it (not current value).
 * - Cash flow deducts scheduled loan payments from `property_loans`;
 *   `mortgage_payment` expense rows are excluded there to avoid double
 *   counting a mortgage the user also logged as an expense.
 */

const MS_PER_DAY = 86_400_000
const DAYS_PER_YEAR = 365.25
const DAYS_PER_MONTH = DAYS_PER_YEAR / 12

export interface PropertySnapshot {
  currency: string
  currentValueCents: number
  isSold: boolean
  purchaseDate: string
  purchaseFeesCents: number
  purchasePriceCents: number
  soldFeesCents?: number | null
  soldPriceCents?: number | null
}

export interface PropertyLoanSnapshot {
  currency: string
  isPaidOff: boolean
  monthlyPaymentCents: number
  outstandingCents: number
}

export interface RentalIncomeEvent {
  amountCents: number
  currency: string
  isPaid: boolean
  periodEnd: string
  periodStart: string
}

export interface PropertyExpenseEvent {
  amountCents: number
  category: string
  currency: string
  expenseDate: string
}

export interface PropertyFinancials {
  loans: PropertyLoanSnapshot[]
  property: PropertySnapshot
  totalExpensesCents: number
  totalIncomeCents: number
}

export interface CurrencyTotals {
  costBasisCents: number
  currency: string
  debtCents: number
  equityCents: number
  expensesCents: number
  incomeCents: number
  netProfitCents: number
  propertyCount: number
  valueCents: number
}

export class MixedCurrencyError extends Error {
  constructor(expected: string, got: string) {
    super(`expected ${expected} but got ${got}`)
    this.name = 'MixedCurrencyError'
  }
}

function utcDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)
}

/** Days in [start, end], both inclusive. */
function daysInclusive(startIso: string, endIso: string): number {
  return Math.round((utcDay(endIso) - utcDay(startIso)) / MS_PER_DAY) + 1
}

export function costBasisCents(p: PropertySnapshot): number {
  return p.purchasePriceCents + p.purchaseFeesCents
}

export function outstandingDebtCents(
  loans: PropertyLoanSnapshot[],
  currency: string
): number {
  let total = 0
  for (const l of loans) {
    if (l.currency !== currency) {
      throw new MixedCurrencyError(currency, l.currency)
    }
    if (!l.isPaidOff) {
      total += l.outstandingCents
    }
  }
  return total
}

export function equityCents(
  p: PropertySnapshot,
  loans: PropertyLoanSnapshot[]
): number {
  return p.currentValueCents - outstandingDebtCents(loans, p.currency)
}

/** Loan-to-value in percent; null when the property has no value. */
export function ltvPct(
  p: PropertySnapshot,
  loans: PropertyLoanSnapshot[]
): number | null {
  if (p.currentValueCents === 0) {
    return null
  }
  return (outstandingDebtCents(loans, p.currency) / p.currentValueCents) * 100
}

/**
 * Paid rental income falling in [fromIso, toIso], prorating periods that
 * straddle a boundary by day overlap.
 */
export function incomeInRangeCents(
  incomes: RentalIncomeEvent[],
  fromIso: string,
  toIso: string
): number {
  let total = 0
  for (const i of incomes) {
    if (!i.isPaid) {
      continue
    }
    const overlapStart =
      utcDay(i.periodStart) >= utcDay(fromIso) ? i.periodStart : fromIso
    const overlapEnd =
      utcDay(i.periodEnd) <= utcDay(toIso) ? i.periodEnd : toIso
    if (utcDay(overlapStart) > utcDay(overlapEnd)) {
      continue
    }
    const overlapDays = daysInclusive(overlapStart, overlapEnd)
    const periodDays = daysInclusive(i.periodStart, i.periodEnd)
    total += Math.round((i.amountCents * overlapDays) / periodDays)
  }
  return total
}

/**
 * Average daily rent (from the earliest paid period start to `asOfIso` or the
 * latest period end, whichever is later) extrapolated to a full year.
 */
export function annualizedRentCents(
  incomes: RentalIncomeEvent[],
  asOfIso: string
): number {
  const paid = incomes.filter((i) => i.isPaid)
  if (paid.length === 0) {
    return 0
  }
  let totalCents = 0
  let firstStart = paid[0]?.periodStart as string
  let lastEnd = asOfIso
  for (const i of paid) {
    totalCents += i.amountCents
    if (utcDay(i.periodStart) < utcDay(firstStart)) {
      firstStart = i.periodStart
    }
    if (utcDay(i.periodEnd) > utcDay(lastEnd)) {
      lastEnd = i.periodEnd
    }
  }
  const spanDays = daysInclusive(firstStart, lastEnd)
  return Math.round((totalCents / spanDays) * DAYS_PER_YEAR)
}

/** Gross rental yield: annual rent over cost basis, in percent. */
export function grossYieldPct(
  p: PropertySnapshot,
  annualRentCents: number
): number | null {
  const basis = costBasisCents(p)
  if (basis === 0) {
    return null
  }
  return (annualRentCents / basis) * 100
}

/** Net rental yield: (annual rent − annual operating expenses) over cost basis. */
export function netYieldPct(
  p: PropertySnapshot,
  annualRentCents: number,
  annualExpensesCents: number
): number | null {
  const basis = costBasisCents(p)
  if (basis === 0) {
    return null
  }
  return ((annualRentCents - annualExpensesCents) / basis) * 100
}

/**
 * Cash flow over [fromIso, toIso]: prorated rent received − expenses dated in
 * range (minus `mortgage_payment` rows) − scheduled payments of active loans
 * for the months the range covers.
 */
export function cashFlowCents(
  incomes: RentalIncomeEvent[],
  expenses: PropertyExpenseEvent[],
  loans: PropertyLoanSnapshot[],
  fromIso: string,
  toIso: string
): number {
  const rent = incomeInRangeCents(incomes, fromIso, toIso)
  let spent = 0
  for (const e of expenses) {
    if (e.category === 'mortgage_payment') {
      continue
    }
    const day = utcDay(e.expenseDate)
    if (day >= utcDay(fromIso) && day <= utcDay(toIso)) {
      spent += e.amountCents
    }
  }
  const months = Math.round(daysInclusive(fromIso, toIso) / DAYS_PER_MONTH)
  let loanPayments = 0
  for (const l of loans) {
    if (!l.isPaidOff) {
      loanPayments += l.monthlyPaymentCents * months
    }
  }
  return rent - spent - loanPayments
}

/**
 * ROI since purchase: (capital gain + rental income − expenses) over cost
 * basis, in percent. Sold properties use sale proceeds net of selling fees.
 */
export function roiPct(
  p: PropertySnapshot,
  totalIncomeCents: number,
  totalExpensesCents: number
): number | null {
  const basis = costBasisCents(p)
  if (basis === 0) {
    return null
  }
  const terminalValue = p.isSold
    ? (p.soldPriceCents ?? 0) - (p.soldFeesCents ?? 0)
    : p.currentValueCents
  const capitalGain = terminalValue - basis
  return ((capitalGain + totalIncomeCents - totalExpensesCents) / basis) * 100
}

/**
 * Roll a set of properties up into one totals row per currency. Sold
 * properties keep contributing income/expenses (realized P&L) but drop out of
 * value, debt, equity, cost basis and the property count.
 */
export function aggregatePortfolio(
  entries: PropertyFinancials[]
): CurrencyTotals[] {
  const byCurrency = new Map<string, CurrencyTotals>()
  for (const {
    property,
    loans,
    totalIncomeCents,
    totalExpensesCents,
  } of entries) {
    let totals = byCurrency.get(property.currency)
    if (!totals) {
      totals = {
        currency: property.currency,
        valueCents: 0,
        debtCents: 0,
        equityCents: 0,
        costBasisCents: 0,
        incomeCents: 0,
        expensesCents: 0,
        netProfitCents: 0,
        propertyCount: 0,
      }
      byCurrency.set(property.currency, totals)
    }
    if (!property.isSold) {
      const debt = outstandingDebtCents(loans, property.currency)
      totals.valueCents += property.currentValueCents
      totals.debtCents += debt
      totals.equityCents += property.currentValueCents - debt
      totals.costBasisCents += costBasisCents(property)
      totals.propertyCount += 1
    }
    totals.incomeCents += totalIncomeCents
    totals.expensesCents += totalExpensesCents
    totals.netProfitCents += totalIncomeCents - totalExpensesCents
  }
  return [...byCurrency.values()]
}
