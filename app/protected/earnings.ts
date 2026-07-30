import {
  clampPeriod,
  currentPeriod,
  type EarningsView,
  earliestIso,
  incomeByCategory,
  isEarningCategory,
  parseEarningsPeriod,
  parseEarningsView,
  periodEndIso,
  periodRangeIso,
  trailingYearStartIso,
} from '@finova/domain/dashboard'
import { incomeInRangeCents as manualAssetIncomeInRangeCents } from '@finova/domain/manual-assets/income'
import type {
  PropertyExpenseEvent,
  PropertyLoanSnapshot,
  RentalIncomeEvent,
} from '@finova/domain/real-estate/metrics'
import { cashFlowCents } from '@finova/domain/real-estate/metrics'
import type { CategoryRow } from '@/lib/validation/category'
import type { DashboardTxn } from './data'
import type { InvestmentsIncome } from './investments/income-data'

export interface EarningsComputation {
  /** Per-category income totals for the selected period, in the display currency. */
  categoryBreakdown: { categoryId: string | null; cents: number }[]
  currentPeriod: string
  dividendCents: number
  earliestPeriod: string
  isPartialYear: boolean
  manualAssetIncomeCents: number
  period: string
  rentCents: number
  view: EarningsView
}

/**
 * Earnings card derived data (dashboard Band 2): resolves the browsable
 * month/year period from URL params, then folds cash-ledger income,
 * dividends, rent, and manual-asset income into one breakdown — split out
 * of DashboardPage because it's a self-contained, pure computation with no
 * JSX of its own (icons/labels are composed by the caller).
 */
export function computeEarnings({
  paramsView,
  paramsPeriod,
  todayIso,
  txns,
  currency,
  categoryById,
  rentEvents,
  propertyExpenseEvents,
  propertyLoanSnapshots,
  invIncome,
  manualAssetIncomeEvents,
}: {
  paramsView?: string
  paramsPeriod?: string
  todayIso: string
  txns: DashboardTxn[]
  currency: string
  categoryById: Map<string, CategoryRow>
  rentEvents: RentalIncomeEvent[]
  propertyExpenseEvents: PropertyExpenseEvent[]
  propertyLoanSnapshots: PropertyLoanSnapshot[]
  invIncome: InvestmentsIncome
  manualAssetIncomeEvents: {
    amountCents: number
    currency: string
    receivedDate: string
  }[]
}): EarningsComputation {
  const view: EarningsView = parseEarningsView(paramsView)
  const current = currentPeriod(view, todayIso)
  const earliestIsoValue = earliestIso([
    ...txns.map((x) => x.occurred_at.slice(0, 10)),
    ...rentEvents.map((e) => e.periodStart),
    ...(invIncome.baseCurrency === currency
      ? invIncome.receivedEventsBase.map((e) => e.date)
      : []),
    ...manualAssetIncomeEvents.map((e) => e.receivedDate),
  ])
  const earliestPeriod = earliestIsoValue
    ? earliestIsoValue.slice(0, view === 'month' ? 7 : 4)
    : current
  const period = clampPeriod(
    parseEarningsPeriod(paramsPeriod, view, todayIso),
    earliestPeriod,
    current
  )
  const isPartialYear = view === 'year' && period === current

  const { start: periodStart } = periodRangeIso(view, period)
  const periodEnd = periodEndIso(view, period, todayIso)

  const periodTxns = txns.filter(
    (x) =>
      x.occurred_at.slice(0, 10) >= periodStart &&
      x.occurred_at.slice(0, 10) <= periodEnd
  )
  const earningTxns = periodTxns.filter((x) =>
    isEarningCategory(
      x.category_id,
      categoryById.get(x.category_id ?? '')?.name_key
    )
  )

  // Dividends/coupons/interest are lumpy/prorated, not naturally monthly —
  // in month view, average the trailing 12 months ending at the selected
  // month (the same "typical monthly amount" idea as the Investments
  // page's forward-annual estimate); in year view, use the real total
  // received in that calendar year, since a full year isn't lumpy the way
  // one month can be.
  const trailingStart =
    view === 'month' ? trailingYearStartIso(periodEnd) : periodStart

  const dividendCents = ((): number => {
    if (invIncome.baseCurrency !== currency) {
      return 0
    }
    const total = invIncome.receivedEventsBase
      .filter((e) => e.date >= trailingStart && e.date <= periodEnd)
      .reduce((sum, e) => sum + e.cents, 0)
    return view === 'month' ? Math.round(total / 12) : total
  })()

  // Rent isn't lumpy the way dividends are: each rental_income row already
  // carries its own period_start/period_end, prorated by day, so the
  // selected period's actual net cash flow is well-defined — use it
  // directly instead of diluting it into a trailing-12-month average.
  const rentCents = cashFlowCents(
    rentEvents,
    propertyExpenseEvents,
    propertyLoanSnapshots,
    periodStart,
    periodEnd
  )

  const manualAssetIncomeCents = ((): number => {
    const total = manualAssetIncomeInRangeCents(
      manualAssetIncomeEvents.filter((e) => e.currency === currency),
      trailingStart,
      periodEnd
    )
    return view === 'month' ? Math.round(total / 12) : total
  })()

  const categoryBreakdown = (incomeByCategory(earningTxns)[currency] ?? []).map(
    (s) => ({ categoryId: s.categoryId, cents: s.total })
  )

  return {
    view,
    period,
    earliestPeriod,
    currentPeriod: current,
    isPartialYear,
    categoryBreakdown,
    dividendCents,
    rentCents,
    manualAssetIncomeCents,
  }
}
