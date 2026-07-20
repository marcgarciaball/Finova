/**
 * Dashboard domain — pure aggregation cores for the Phase 4 surface. No I/O, no
 * React, no FX fetching; every figure is per-currency and never summed across.
 */
export {
  type AccountSpend,
  type AccountTxn,
  spendingByAccount,
} from '@/lib/domain/dashboard/by-account'
export {
  type CategorizedTxn,
  type CategorySpend,
  incomeByCategory,
  spendingByCategory,
} from '@/lib/domain/dashboard/by-category'
export {
  type MerchantSpend,
  type MerchantTxn,
  spendingByMerchant,
} from '@/lib/domain/dashboard/by-merchant'
export {
  type AreaSeries,
  type BarSeries,
  balanceTrendToArea,
  monthlySeriesToBars,
  spendingToDonut,
} from '@/lib/domain/dashboard/chart-data'
export {
  pctChange,
  previousPeriodRange,
  previousPeriodTxns,
  type Trend,
  trendOf,
} from '@/lib/domain/dashboard/compare'
export { pickDisplayCurrency } from '@/lib/domain/dashboard/display-currency'
export {
  type BiggestExpense,
  type BusiestDay,
  type KeyStats,
  keyStats,
  type StatTxn,
} from '@/lib/domain/dashboard/key-stats'
export {
  balanceTrend,
  GRANULARITIES,
  type Granularity,
  incomeExpenseSeries,
  type MonthBucket,
  monthlySeries,
  parseGranularity,
  type TimedTxn,
  type TrendPoint,
} from '@/lib/domain/dashboard/over-time'
export {
  filterByPeriod,
  PERIODS,
  type Period,
  parsePeriod,
  periodStartIso,
} from '@/lib/domain/dashboard/period'
export {
  type AccountBalance,
  accountBalances,
  type BalanceAccount,
  type BalanceTxn,
  savingsRate,
  totalBalanceByCurrency,
} from '@/lib/domain/dashboard/summary'
export {
  type ExpenseTxn,
  type TopExpense,
  topExpenses,
} from '@/lib/domain/dashboard/top-expenses'
