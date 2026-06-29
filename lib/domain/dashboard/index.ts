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
  spendingByCategory,
} from '@/lib/domain/dashboard/by-category'
export {
  type AreaSeries,
  type BarSeries,
  balanceTrendToArea,
  monthlySeriesToBars,
  spendingToDonut,
} from '@/lib/domain/dashboard/chart-data'
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
  type MonthBucket,
  monthlySeries,
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
