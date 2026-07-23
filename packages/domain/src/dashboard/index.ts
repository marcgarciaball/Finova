/**
 * Dashboard domain — pure aggregation cores for the Phase 4 surface. No I/O, no
 * React, no FX fetching; every figure is per-currency and never summed across.
 */
export {
  type AccountSpend,
  type AccountTxn,
  spendingByAccount,
} from './by-account'
export {
  type CategorizedTxn,
  type CategorySpend,
  incomeByCategory,
  spendingByCategory,
} from './by-category'
export {
  type MerchantSpend,
  type MerchantTxn,
  spendingByMerchant,
} from './by-merchant'
export {
  type AreaSeries,
  type BarSeries,
  balanceTrendToArea,
  monthlySeriesToBars,
  spendingToDonut,
} from './chart-data'
export {
  pctChange,
  previousPeriodRange,
  previousPeriodTxns,
  type Trend,
  trendOf,
} from './compare'
export { pickDisplayCurrency } from './display-currency'
export {
  EARNINGS_EXCLUDED_CATEGORY_NAME_KEYS,
  isEarningCategory,
} from './earnings'
export {
  type BiggestExpense,
  type BusiestDay,
  type KeyStats,
  keyStats,
  type StatTxn,
} from './key-stats'
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
} from './over-time'
export {
  filterByPeriod,
  PERIODS,
  type Period,
  parsePeriod,
  periodStartIso,
} from './period'
export {
  type AccountBalance,
  accountBalances,
  type BalanceAccount,
  type BalanceTxn,
  savingsRate,
  totalBalanceByCurrency,
} from './summary'
export {
  type ExpenseTxn,
  type TopExpense,
  topExpenses,
} from './top-expenses'
