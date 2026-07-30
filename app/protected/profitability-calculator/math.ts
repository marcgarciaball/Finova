/** Rounds to the nearest cent so chart/tooltip values don't show float noise. */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export type CompoundingFrequency = 'monthly' | 'quarterly' | 'annually'

const PERIODS_PER_YEAR: Record<CompoundingFrequency, number> = {
  monthly: 12,
  quarterly: 4,
  annually: 1,
}

/** Converts a nominal annual rate (compounded at the given frequency) into an equivalent effective monthly rate, so growth can be simulated month by month regardless of compounding frequency. */
function monthlyRateFor(
  annualRatePct: number,
  compounding: CompoundingFrequency
): number {
  const n = PERIODS_PER_YEAR[compounding]
  const periodicRate = annualRatePct / 100 / n
  return (1 + periodicRate) ** (n / 12) - 1
}

export interface GrowthPoint {
  balance: number
  year: number
  [key: string]: number
}

export interface GrowthResult {
  futureValue: number
  points: GrowthPoint[]
  totalContributed: number
  totalInterest: number
}

export function projectGrowth({
  initialCapital,
  monthlyContribution,
  annualRatePct,
  years,
  compounding,
}: {
  initialCapital: number
  monthlyContribution: number
  annualRatePct: number
  years: number
  compounding: CompoundingFrequency
}): GrowthResult {
  const monthlyRate = monthlyRateFor(annualRatePct, compounding)
  const totalMonths = Math.max(0, Math.round(years * 12))
  const points: GrowthPoint[] = [{ year: 0, balance: round2(initialCapital) }]
  let balance = initialCapital
  for (let month = 1; month <= totalMonths; month++) {
    balance = balance * (1 + monthlyRate) + monthlyContribution
    if (month % 12 === 0) {
      points.push({ year: month / 12, balance: round2(balance) })
    }
  }
  const totalContributed = initialCapital + monthlyContribution * totalMonths
  return {
    points,
    futureValue: balance,
    totalContributed,
    totalInterest: balance - totalContributed,
  }
}

/** Capital needed to sustain a monthly income target by withdrawing the annual return without touching the principal. */
export function capitalRequiredForIncome(
  monthlyIncomeTarget: number,
  annualRatePct: number
): number {
  if (annualRatePct <= 0) return Number.POSITIVE_INFINITY
  return (monthlyIncomeTarget * 12) / (annualRatePct / 100)
}

/** Months (as fractional years) of contributing at `annualRatePct` before `initialCapital` grows to `targetCapital`; null if unreachable within `maxYears`. */
export function yearsToReachCapital({
  targetCapital,
  initialCapital,
  monthlyContribution,
  annualRatePct,
  compounding,
  maxYears = 60,
}: {
  targetCapital: number
  initialCapital: number
  monthlyContribution: number
  annualRatePct: number
  compounding: CompoundingFrequency
  maxYears?: number
}): number | null {
  if (initialCapital >= targetCapital) return 0
  const monthlyRate = monthlyRateFor(annualRatePct, compounding)
  const maxMonths = maxYears * 12
  let balance = initialCapital
  for (let month = 1; month <= maxMonths; month++) {
    balance = balance * (1 + monthlyRate) + monthlyContribution
    if (balance >= targetCapital) return month / 12
  }
  return null
}

export interface DividendPoint {
  balance: number
  dividendIncome: number
  year: number
  [key: string]: number
}

export interface DividendResult {
  finalAnnualIncome: number
  finalMonthlyIncome: number
  futureValue: number
  points: DividendPoint[]
  totalDividendsReceived: number
}

function monthlyRateFromAnnual(annualRatePct: number): number {
  return (1 + annualRatePct / 100) ** (1 / 12) - 1
}

/**
 * Simulates a dividend-paying position month by month. The share price itself
 * compounds at `priceAppreciationPct` (this is what makes the position grow
 * beyond just the dividends — a flat/no-growth price only ever grows through
 * reinvested dividends and new contributions). The yield is applied to the
 * current balance and grows year over year (dividend raises); with `reinvest`
 * on, paid dividends compound back in (DRIP) — otherwise they're cash income
 * and only price appreciation and new contributions grow the balance.
 */
export function projectDividends({
  initialCapital,
  monthlyContribution,
  dividendYieldPct,
  dividendGrowthPct,
  priceAppreciationPct,
  years,
  reinvest,
}: {
  initialCapital: number
  monthlyContribution: number
  dividendYieldPct: number
  dividendGrowthPct: number
  priceAppreciationPct: number
  years: number
  reinvest: boolean
}): DividendResult {
  const totalMonths = Math.max(0, Math.round(years * 12))
  const monthlyPriceRate = monthlyRateFromAnnual(priceAppreciationPct)
  const points: DividendPoint[] = [
    { balance: round2(initialCapital), dividendIncome: 0, year: 0 },
  ]
  let balance = initialCapital
  let currentYieldPct = dividendYieldPct
  let cumulativeDividends = 0
  let lastMonthlyDividend = 0
  for (let month = 1; month <= totalMonths; month++) {
    balance *= 1 + monthlyPriceRate
    if (month > 1 && (month - 1) % 12 === 0) {
      currentYieldPct *= 1 + dividendGrowthPct / 100
    }
    const monthlyDividend = (balance * currentYieldPct) / 100 / 12
    cumulativeDividends += monthlyDividend
    lastMonthlyDividend = monthlyDividend
    balance += monthlyContribution + (reinvest ? monthlyDividend : 0)
    if (month % 12 === 0) {
      points.push({
        balance: round2(balance),
        dividendIncome: round2(monthlyDividend * 12),
        year: month / 12,
      })
    }
  }
  return {
    finalAnnualIncome: lastMonthlyDividend * 12,
    finalMonthlyIncome: lastMonthlyDividend,
    futureValue: balance,
    points,
    totalDividendsReceived: cumulativeDividends,
  }
}

/** Months (as fractional years) of contributing and reinvesting dividends before the monthly dividend payout reaches `targetMonthlyIncome`; null if unreachable within `maxYears`. */
export function yearsToReachDividendIncome({
  initialCapital,
  monthlyContribution,
  dividendYieldPct,
  dividendGrowthPct,
  priceAppreciationPct,
  targetMonthlyIncome,
  maxYears = 60,
}: {
  initialCapital: number
  monthlyContribution: number
  dividendYieldPct: number
  dividendGrowthPct: number
  priceAppreciationPct: number
  targetMonthlyIncome: number
  maxYears?: number
}): number | null {
  const monthlyPriceRate = monthlyRateFromAnnual(priceAppreciationPct)
  let balance = initialCapital
  let currentYieldPct = dividendYieldPct
  if ((balance * currentYieldPct) / 100 / 12 >= targetMonthlyIncome) return 0
  const maxMonths = maxYears * 12
  for (let month = 1; month <= maxMonths; month++) {
    balance *= 1 + monthlyPriceRate
    if (month > 1 && (month - 1) % 12 === 0) {
      currentYieldPct *= 1 + dividendGrowthPct / 100
    }
    const monthlyDividend = (balance * currentYieldPct) / 100 / 12
    if (monthlyDividend >= targetMonthlyIncome) return month / 12
    balance += monthlyContribution + monthlyDividend
  }
  return null
}

/** Fixed monthly payment (principal + interest) for a fully amortizing loan. */
export function monthlyLoanPayment(
  loanAmount: number,
  annualRatePct: number,
  termYears: number
): number {
  const n = Math.round(termYears * 12)
  if (n <= 0) return 0
  const r = annualRatePct / 100 / 12
  if (r === 0) return loanAmount / n
  const factor = (1 + r) ** n
  return (loanAmount * r * factor) / (factor - 1)
}

/** Remaining balance of a fully amortizing loan after `monthsElapsed` payments. */
function remainingLoanBalance(
  loanAmount: number,
  annualRatePct: number,
  termYears: number,
  monthsElapsed: number
): number {
  const n = Math.round(termYears * 12)
  const elapsed = Math.min(monthsElapsed, n)
  if (elapsed <= 0) return loanAmount
  const r = annualRatePct / 100 / 12
  if (r === 0) {
    return Math.max(0, loanAmount * (1 - elapsed / n))
  }
  const payment = monthlyLoanPayment(loanAmount, annualRatePct, termYears)
  const balance =
    loanAmount * (1 + r) ** elapsed - payment * (((1 + r) ** elapsed - 1) / r)
  return Math.max(0, balance)
}

export interface EquityPoint {
  equity: number
  loanBalance: number
  propertyValue: number
  year: number
  [key: string]: number
}

export interface RentalAnalysis {
  annualCashFlow: number
  capRatePct: number
  cashOnCashReturnPct: number
  downPaymentAmount: number
  equityPoints: EquityPoint[]
  grossYieldPct: number
  monthlyCashFlow: number
  monthlyMortgagePayment: number
  monthlyNetOperatingIncome: number
}

/** Standard rental property profitability metrics: cash flow, cap rate, cash-on-cash return, plus a long-term equity projection. */
export function analyzeRental({
  purchasePrice,
  downPaymentPct,
  mortgageRatePct,
  mortgageTermYears,
  monthlyRent,
  monthlyOperatingExpenses,
  vacancyPct,
  managementFeePct,
  appreciationPct,
  years,
}: {
  purchasePrice: number
  downPaymentPct: number
  mortgageRatePct: number
  mortgageTermYears: number
  monthlyRent: number
  monthlyOperatingExpenses: number
  vacancyPct: number
  managementFeePct: number
  appreciationPct: number
  years: number
}): RentalAnalysis {
  const downPaymentAmount = purchasePrice * (downPaymentPct / 100)
  const loanAmount = purchasePrice - downPaymentAmount
  const monthlyMortgagePayment =
    loanAmount > 0
      ? monthlyLoanPayment(loanAmount, mortgageRatePct, mortgageTermYears)
      : 0
  const effectiveMonthlyRent = monthlyRent * (1 - vacancyPct / 100)
  const managementFee = effectiveMonthlyRent * (managementFeePct / 100)
  const monthlyNetOperatingIncome =
    effectiveMonthlyRent - managementFee - monthlyOperatingExpenses
  const monthlyCashFlow = monthlyNetOperatingIncome - monthlyMortgagePayment
  const annualCashFlow = monthlyCashFlow * 12

  const capRatePct =
    purchasePrice > 0
      ? ((monthlyNetOperatingIncome * 12) / purchasePrice) * 100
      : 0
  const cashOnCashReturnPct =
    downPaymentAmount > 0 ? (annualCashFlow / downPaymentAmount) * 100 : 0
  const grossYieldPct =
    purchasePrice > 0 ? ((monthlyRent * 12) / purchasePrice) * 100 : 0

  const equityPoints: EquityPoint[] = []
  for (let year = 0; year <= years; year++) {
    const propertyValue = purchasePrice * (1 + appreciationPct / 100) ** year
    const loanBalance = remainingLoanBalance(
      loanAmount,
      mortgageRatePct,
      mortgageTermYears,
      year * 12
    )
    equityPoints.push({
      equity: round2(propertyValue - loanBalance),
      loanBalance: round2(loanBalance),
      propertyValue: round2(propertyValue),
      year,
    })
  }

  return {
    annualCashFlow,
    capRatePct,
    cashOnCashReturnPct,
    downPaymentAmount,
    equityPoints,
    grossYieldPct,
    monthlyCashFlow,
    monthlyMortgagePayment,
    monthlyNetOperatingIncome,
  }
}
