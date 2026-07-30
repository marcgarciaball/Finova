import { categoryLabel } from '@finova/domain/categories/label'
import {
  accountBalances,
  balanceTrend,
  balanceTrendToArea,
  dayBeforeIso,
  filterByPeriod,
  incomeExpenseSeries,
  keyStats,
  monthlySeriesToBars,
  parseGranularity,
  parsePeriod,
  pctChange,
  periodStartIso,
  pickDisplayCurrency,
  previousPeriodRange,
  previousPeriodTxns,
  savingsRate,
  spendingByAccount,
  spendingByCategory,
  spendingToDonut,
  totalBalanceByCurrency,
  trendOf,
} from '@finova/domain/dashboard'
import { incomeInRangeCents as manualAssetIncomeInRangeCents } from '@finova/domain/manual-assets/income'
import { incomeInRangeCents } from '@finova/domain/real-estate/metrics'
import { summarizeByCurrency } from '@finova/domain/transactions/totals'
import { Plus } from 'lucide-react'
import { getLocale, getTranslations } from 'next-intl/server'
import { AreaChart } from '@/components/charts/AreaChart'
import { BarChart } from '@/components/charts/BarChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { CategoryIcon } from '@/components/dashboard/CategoryIcon'
import { HeroCard } from '@/components/dashboard/HeroCard'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { NetWorthCard } from '@/components/dashboard/NetWorthCard'
import { QuickAddTransaction } from '@/components/transactions/QuickAddTransaction'
import { Button } from '@/components/ui/Button'
import { GlassCard } from '@/components/ui/GlassCard'
import type { CategoryRow } from '@/lib/validation/category'
import { AccountsStrip } from './AccountsStrip'
import { BandSection } from './BandSection'
import { CategorizeEmptyState } from './CategorizeEmptyState'
import { CurrencyBreakdown } from './CurrencyBreakdown'
import { DashboardEmptyState } from './DashboardEmptyState'
import { DataHealthBanner } from './DataHealthBanner'
import { getDashboardData } from './data'
import { getDebtsSummary } from './debts/data'
import { EarningsCard } from './EarningsCard'
import { computeEarnings } from './earnings'
import { GranularitySelector } from './GranularitySelector'
import { InsightsPlaceholder } from './InsightsPlaceholder'
import { getInvestmentsIncome } from './investments/income-data'
import { getInvestmentsOverview } from './investments/overview-data'
import { KeyStatsStrip } from './KeyStatsStrip'
import {
  getManualAssetIncomeEvents,
  getManualAssetsValueByCurrency,
} from './manual-assets/data'
import { PeriodSelector } from './PeriodSelector'
import { RecentTransactions } from './RecentTransactions'
import {
  getPropertyExpenseEvents,
  getPropertyLoanSnapshots,
  getRealEstateEquityByCurrency,
  getRentalIncomeEvents,
  getRentedPropertyIds,
} from './real-estate/data'
import { type RankRow, SpendingRanking } from './SpendingRanking'
import { WealthAllocation } from './WealthAllocation'

const RECENT_LIMIT = 6
const UNCATEGORIZED_THRESHOLD = 0.4

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    granularity?: string
    period?: string
    earningsView?: string
    earningsPeriod?: string
  }>
}) {
  const t = await getTranslations('dashboard')
  const tDefaults = await getTranslations('categories.defaults')
  const locale = await getLocale()

  const { accounts, categories, txns, baseCurrency } = await getDashboardData()
  const params = await searchParams
  const period = parsePeriod(params.period)
  const granularity = parseGranularity(params.granularity)

  if (accounts.length === 0 || txns.length === 0) {
    return (
      <div className="flex w-full flex-1 flex-col gap-6">
        <h1 className="font-bold text-2xl">{t('title')}</h1>
        <DashboardEmptyState />
      </div>
    )
  }

  const todayIso = new Date().toISOString().slice(0, 10)
  const currency = pickDisplayCurrency(txns, baseCurrency)

  // Period-sensitive figures use the sliced set; balances/trend are cumulative.
  const periodTxns = filterByPeriod(txns, period, todayIso)
  const prevTxns = previousPeriodTxns(txns, period, todayIso)

  const cashTotals = summarizeByCurrency(periodTxns)[currency] ?? {
    income: 0,
    expense: 0,
    net: 0,
  }
  const prevCashTotals = summarizeByCurrency(prevTxns)[currency] ?? {
    income: 0,
    expense: 0,
    net: 0,
  }

  // Dividends live in the investments module, not the cash ledger — fold the
  // period's received events into income (base currency only, by pay date).
  const invIncome = await getInvestmentsIncome()
  const periodStart = periodStartIso(period, todayIso)
  const prevRange = previousPeriodRange(period, todayIso)
  const dividendsIn = (
    start: string | null,
    endExclusive: string | null
  ): number =>
    invIncome.baseCurrency === currency
      ? invIncome.receivedEventsBase
          .filter(
            (e) =>
              (start === null || e.date >= start) &&
              (endExclusive === null
                ? e.date <= todayIso
                : e.date < endExclusive)
          )
          .reduce((sum, e) => sum + e.cents, 0)
      : 0
  const dividendCents = dividendsIn(periodStart, null)
  const prevDividendCents = prevRange
    ? dividendsIn(prevRange.startIso, prevRange.endExclusiveIso)
    : 0

  // Rental income lives in the Real Estate module, not the cash ledger —
  // fold paid rent into income the same way dividends are folded in above.
  // Never converted across currencies, so only rows in the display currency
  // count (matches getRealEstateEquityByCurrency's per-currency treatment).
  // Rows span arbitrary date ranges (a lease can straddle month or period
  // boundaries), so amounts are prorated by day overlap — same as the Real
  // Estate page's own cash-flow figures — rather than matched to one date.
  const rentEvents = (await getRentalIncomeEvents()).filter(
    (e) => e.currency === currency
  )
  // Net rent against costs for the Earnings card only — mortgage/maintenance
  // spend so "how much I earn" reflects take-home, not gross rent received.
  // Scoped to currently-rented properties so a primary residence's own
  // mortgage/expenses (which earn no rent at all) never offset rental
  // income they have nothing to do with.
  const rentedPropertyIds = await getRentedPropertyIds()
  const propertyExpenseEvents = (await getPropertyExpenseEvents()).filter(
    (e) =>
      e.currency === currency &&
      e.propertyId !== undefined &&
      rentedPropertyIds.has(e.propertyId)
  )
  const propertyLoanSnapshots = (await getPropertyLoanSnapshots()).filter(
    (l) =>
      l.currency === currency &&
      l.propertyId !== undefined &&
      rentedPropertyIds.has(l.propertyId)
  )
  const EARLIEST_ISO = '1900-01-01'
  const rentIn = (start: string | null, endExclusive: string | null): number =>
    incomeInRangeCents(
      rentEvents,
      start ?? EARLIEST_ISO,
      endExclusive === null ? todayIso : dayBeforeIso(endExclusive)
    )
  const rentCents = rentIn(periodStart, null)
  const prevRentCents = prevRange
    ? rentIn(prevRange.startIso, prevRange.endExclusiveIso)
    : 0

  // Manual assets (bond coupons, P2P interest, distributions, …) — folded in
  // the same way as rent, filtered to the display currency.
  const manualAssetIncomeEvents = (await getManualAssetIncomeEvents()).filter(
    (e) => e.currency === currency
  )
  const manualIncomeIn = (
    start: string | null,
    endExclusive: string | null
  ): number =>
    manualAssetIncomeInRangeCents(
      manualAssetIncomeEvents,
      start ?? EARLIEST_ISO,
      endExclusive === null ? todayIso : dayBeforeIso(endExclusive)
    )
  const manualAssetIncomeCents = manualIncomeIn(periodStart, null)
  const prevManualAssetIncomeCents = prevRange
    ? manualIncomeIn(prevRange.startIso, prevRange.endExclusiveIso)
    : 0

  const totals = {
    income:
      cashTotals.income + dividendCents + rentCents + manualAssetIncomeCents,
    expense: cashTotals.expense,
    net: cashTotals.net + dividendCents + rentCents + manualAssetIncomeCents,
  }
  const prevTotals = {
    income:
      prevCashTotals.income +
      prevDividendCents +
      prevRentCents +
      prevManualAssetIncomeCents,
    expense: prevCashTotals.expense,
    net:
      prevCashTotals.net +
      prevDividendCents +
      prevRentCents +
      prevManualAssetIncomeCents,
  }
  const rate = savingsRate(totals)
  const prevRate = savingsRate(prevTotals)

  // KPI deltas (whole %, hidden when the baseline is non-positive).
  const incomeDelta = pctChange(totals.income, prevTotals.income)
  const expenseDelta = pctChange(totals.expense, prevTotals.expense)
  const netDelta = pctChange(totals.net, prevTotals.net)
  // Savings rate moves in percentage POINTS, not %-of-%.
  const rateDelta =
    rate === null || prevRate === null
      ? null
      : Math.round((rate - prevRate) * 100)

  const balanceAccounts = accounts.map((a) => ({
    id: a.id,
    currency: a.currency,
    opening_balance: a.opening_balance,
  }))
  const balances = accountBalances(balanceAccounts, txns)
  const totalByCurrency = totalBalanceByCurrency(balances)
  const cashCents = totalByCurrency[currency] ?? 0
  // Net worth = cash accounts + investment portfolio value (priced positions,
  // in the portfolio's base currency).
  const investments = await getInvestmentsOverview()
  if (investments.totals.totalValueCents > 0) {
    totalByCurrency[investments.baseCurrency] =
      (totalByCurrency[investments.baseCurrency] ?? 0) +
      investments.totals.totalValueCents
  }
  // Real estate joins net worth as equity (value − outstanding loans),
  // per property currency — never converted across currencies here.
  const realEstateEquity = await getRealEstateEquityByCurrency()
  for (const re of realEstateEquity) {
    if (re.equityCents !== 0) {
      totalByCurrency[re.currency] =
        (totalByCurrency[re.currency] ?? 0) + re.equityCents
    }
  }
  const realEstateCents =
    realEstateEquity.find((re) => re.currency === currency)?.equityCents ?? 0
  // Manual assets (bonds, private equity, P2P loans, collectibles, …) join
  // net worth at their latest manually-entered value, per currency — never
  // converted across currencies, same treatment as real estate equity.
  const manualAssetsValue = await getManualAssetsValueByCurrency()
  for (const ma of manualAssetsValue) {
    if (ma.valueCents !== 0) {
      totalByCurrency[ma.currency] =
        (totalByCurrency[ma.currency] ?? 0) + ma.valueCents
    }
  }
  const manualAssetsCents =
    manualAssetsValue.find((ma) => ma.currency === currency)?.valueCents ?? 0
  const totalBalance = totalByCurrency[currency] ?? 0

  // Assets/debts/net-worth breakdown (display currency only). `totalBalance`
  // above already is cash + investments + real-estate EQUITY + manual assets
  // (never subtracting standalone debt), so adding back the mortgage slice
  // of `debtsSummary` recovers real estate's GROSS value without a second
  // real-estate query; subtracting ALL debt (mortgage + other) then gives a
  // net worth that — unlike the headline figure above — correctly accounts
  // for car loans, personal loans, and credit cards too.
  const debtsSummary = await getDebtsSummary()
  const currencyDebtTotals = debtsSummary.find((d) => d.currency === currency)
  const totalDebtsCents = currencyDebtTotals?.totalOutstandingCents ?? 0
  const mortgageDebtCents = currencyDebtTotals?.outstandingByType.mortgage ?? 0
  const totalAssetsCents = totalBalance + mortgageDebtCents
  const netWorthCents = totalAssetsCents - totalDebtsCents
  const debtToAssetRatioPct =
    totalAssetsCents > 0 ? (totalDebtsCents / totalAssetsCents) * 100 : null
  // Investment amounts only line up with cash when the portfolio's base
  // currency matches the dashboard's display currency. allocationByType is
  // a fraction of total value (0..1) — convert to cents for the card.
  const investedByType: Partial<Record<string, number>> = {}
  if (investments.baseCurrency === currency) {
    for (const [type, share] of Object.entries(
      investments.totals.allocationByType
    )) {
      investedByType[type] = Math.round(
        share * investments.totals.totalValueCents
      )
    }
  }

  // Trend opening = balance carried into the period start (full history before).
  const start = periodStartIso(period, todayIso)
  const before = start
    ? txns.filter((x) => x.occurred_at.slice(0, 10) < start)
    : []
  const opening = totalBalanceByCurrency(
    accountBalances(balanceAccounts, before)
  )
  const trend = balanceTrend(periodTxns, opening)[currency] ?? []

  const months = incomeExpenseSeries(periodTxns, granularity)[currency] ?? []
  const bars = monthlySeriesToBars(months)
  const area = balanceTrendToArea(trend)
  const balanceSparkline = trend.map((p) => p.balance / 100)

  const byId = new Map(categories.map((c) => [c.id, c] as const))
  const labelFor = (categoryId: string | null): string =>
    categoryId === null
      ? t('table.uncategorized')
      : labelOf(byId.get(categoryId), tDefaults)
  const colorFor = (categoryId: string | null): string | undefined =>
    categoryId === null ? undefined : (byId.get(categoryId)?.color ?? undefined)
  const iconFor = (categoryId: string | null) => (
    <CategoryIcon
      iconName={
        categoryId === null ? undefined : byId.get(categoryId)?.icon_name
      }
      color={colorFor(categoryId)}
      className={colorFor(categoryId) ? undefined : 'text-ink-soft'}
    />
  )

  const spend = spendingByCategory(periodTxns)[currency] ?? []
  const prevSpend = spendingByCategory(prevTxns)[currency] ?? []
  const prevByCategory = new Map(
    prevSpend.map(
      (s) => [s.categoryId ?? '__uncategorized__', s.total] as const
    )
  )
  const donut = spendingToDonut(spend, labelFor, colorFor)
  const categoryRanking: RankRow[] = spend.map((s) => {
    const key = s.categoryId ?? '__uncategorized__'
    return {
      key,
      label: labelFor(s.categoryId),
      icon: iconFor(s.categoryId),
      total: s.total,
      share: s.share,
      currency,
      trend: trendOf(s.total, prevByCategory.get(key) ?? 0),
    }
  })

  // Earnings card: browsable by month or year via ?earningsView=/
  // ?earningsPeriod= (mirrors the ?period=/?granularity= pattern above),
  // instead of pinning to one "reference month". A transaction's earnings
  // category is looked up in whichever period is actually selected, so a
  // salary payment from a past month is never silently skipped just because
  // the current month happens to have other income. The period math and
  // income-source folding is a pure computation with no JSX, so it lives in
  // its own module (icons/labels are composed here from the breakdown).
  const earnings = computeEarnings({
    categoryById: byId,
    currency,
    invIncome,
    manualAssetIncomeEvents,
    paramsPeriod: params.earningsPeriod,
    paramsView: params.earningsView,
    propertyExpenseEvents,
    propertyLoanSnapshots,
    rentEvents,
    todayIso,
    txns,
  })

  const earningsRows = [
    ...earnings.categoryBreakdown.map((s) => ({
      key: s.categoryId ?? '__uncategorized__',
      label: labelFor(s.categoryId),
      icon: iconFor(s.categoryId),
      cents: s.cents,
    })),
    ...(earnings.dividendCents > 0
      ? [
          {
            key: '__dividends__',
            label: t('ranking.dividends'),
            icon: <CategoryIcon iconName="HandCoins" />,
            cents: earnings.dividendCents,
          },
        ]
      : []),
    ...(earnings.rentCents > 0
      ? [
          {
            key: '__rent__',
            label: t('ranking.rent'),
            icon: <CategoryIcon iconName="Home" />,
            cents: earnings.rentCents,
          },
        ]
      : []),
    ...(earnings.manualAssetIncomeCents > 0
      ? [
          {
            key: '__manual_assets_income__',
            label: t('ranking.manualAssetsIncome'),
            icon: <CategoryIcon iconName="Landmark" />,
            cents: earnings.manualAssetIncomeCents,
          },
        ]
      : []),
  ].sort((a, b) => b.cents - a.cents)

  const accountById = new Map(accounts.map((a) => [a.id, a] as const))
  const accountRanking: RankRow[] = (
    spendingByAccount(periodTxns)[currency] ?? []
  ).map((s) => ({
    key: s.accountId,
    label: accountById.get(s.accountId)?.name ?? s.accountId,
    total: s.total,
    share: s.share,
    currency,
  }))

  const stats = keyStats(periodTxns)[currency] ?? {
    averageSpend: null,
    biggestExpense: null,
    busiestDay: null,
    count: 0,
  }

  const currencyCount = new Set(txns.map((x) => x.currency)).size

  // Data-health: uncategorized spend and whether it dominates the period.
  const totalSpend = spend.reduce((sum, s) => sum + s.total, 0)
  const uncategorizedCents =
    spend.find((s) => s.categoryId === null)?.total ?? 0
  const uncategorizedShare =
    totalSpend === 0 ? 0 : uncategorizedCents / totalSpend
  const onlyUncategorized =
    spend.length > 0 && spend.every((s) => s.categoryId === null)

  return (
    <div className="flex w-full flex-1 flex-col gap-10">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-bold text-2xl">{t('title')}</h1>
          <PeriodSelector value={period} />
        </div>
        {currencyCount > 1 && (
          <p className="text-ink-soft text-sm">
            {t('otherCurrencies', { currency })}
          </p>
        )}
      </div>

      {/* Data-health banner (shown only when uncategorized dominates). */}
      {uncategorizedShare >= UNCATEGORIZED_THRESHOLD && (
        <DataHealthBanner
          uncategorizedCents={uncategorizedCents}
          currency={currency}
          locale={locale}
        />
      )}

      {/* Band 1 — How much do I have? */}
      <BandSection title={t('bands.have')}>
        <HeroCard
          className="col-span-12 lg:col-span-8"
          label={`${t('accountsStrip.netWorth')} · ${currency}`}
          value={totalBalance}
          currency={currency}
          locale={locale}
          trend={balanceSparkline}
        />
        <NetWorthCard
          className="col-span-12 lg:col-span-4"
          totalAssetsCents={totalAssetsCents}
          totalDebtsCents={totalDebtsCents}
          netWorthCents={netWorthCents}
          currency={currency}
          locale={locale}
          debtToAssetRatioPct={debtToAssetRatioPct}
        />
        <CurrencyBreakdown
          className="col-span-12 lg:col-span-4"
          netWorthByCurrency={totalByCurrency}
          baseCurrency={baseCurrency}
          locale={locale}
          title={t('currencyBreakdown.title')}
          baseLabel={t('currencyBreakdown.base')}
        />
        <WealthAllocation
          className="col-span-12 lg:col-span-4"
          cashCents={cashCents}
          investedByType={investedByType}
          realEstateCents={realEstateCents}
          manualAssetsCents={manualAssetsCents}
          currency={currency}
        />
        <AccountsStrip
          className="col-span-12 lg:col-span-8"
          accounts={accounts}
          balances={balances}
        />
      </BandSection>

      {/* Band 2 — Am I earning more than I spend? */}
      <BandSection title={t('bands.earn')}>
        <div className="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 lg:col-span-5">
          <KpiCard
            label={t('kpi.income')}
            value={totals.income}
            currency={currency}
            locale={locale}
            delta={incomeDelta ?? undefined}
            deltaSuffix="%"
            footnote={t('delta.vsPrev')}
          />
          <KpiCard
            label={t('kpi.expense')}
            value={totals.expense}
            currency={currency}
            locale={locale}
            delta={expenseDelta ?? undefined}
            deltaSuffix="%"
            footnote={t('delta.vsPrev')}
          />
          <KpiCard
            label={t('kpi.savingsRate')}
            value={rate === null ? 0 : Math.round(rate * 100)}
            suffix="%"
            empty={rate === null}
            delta={rateDelta ?? undefined}
            deltaSuffix="pp"
            footnote={t('kpi.savingsRateNote')}
          />
          <KpiCard
            label={t('kpi.net')}
            value={totals.net}
            currency={currency}
            locale={locale}
            delta={netDelta ?? undefined}
            deltaSuffix="%"
            footnote={t('kpi.netNote')}
          />
        </div>
        <GlassCard className="col-span-12 flex flex-col gap-4 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
              {t('charts.incomeVsExpense')}
            </h3>
            <GranularitySelector value={granularity} />
          </div>
          <BarChart
            index={bars.index}
            categories={bars.categories}
            data={bars.data}
          />
        </GlassCard>
        <EarningsCard
          className="col-span-12"
          rows={earningsRows}
          view={earnings.view}
          period={earnings.period}
          earliestPeriod={earnings.earliestPeriod}
          latestPeriod={earnings.currentPeriod}
          isPartialYear={earnings.isPartialYear}
          currency={currency}
        />
      </BandSection>

      {/* Band 3 — Where does my money go? */}
      <BandSection title={t('bands.spend')}>
        <GlassCard className="col-span-12 flex flex-col gap-4 lg:col-span-5">
          <h3 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
            {t('charts.spendingByCategory')}
          </h3>
          {onlyUncategorized || donut.length === 0 ? (
            <CategorizeEmptyState
              title={t('donutEmpty.title')}
              body={t('donutEmpty.body')}
              cta={t('donutEmpty.cta')}
            />
          ) : (
            <DonutChart data={donut} />
          )}
        </GlassCard>
        <SpendingRanking
          className="col-span-12 lg:col-span-7"
          title={t('ranking.topCategories')}
          rows={categoryRanking}
          locale={locale}
          emptyLabel={t('ranking.empty')}
        />
        <SpendingRanking
          className="col-span-12 lg:col-span-6"
          title={t('ranking.byAccount')}
          rows={accountRanking}
          locale={locale}
          emptyLabel={t('ranking.empty')}
        />
        <div className="col-span-12 lg:col-span-6">
          <KeyStatsStrip stats={stats} currency={currency} />
        </div>
        <GlassCard className="col-span-12 flex flex-col gap-4">
          <h3 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
            {t('charts.balanceTrend')}
          </h3>
          <AreaChart
            index={area.index}
            categories={area.categories}
            data={area.data}
          />
        </GlassCard>
      </BandSection>

      {/* Band 4 — What's happening? */}
      <BandSection title={t('bands.activity')}>
        <div className="col-span-12 lg:col-span-7">
          <RecentTransactions
            txns={periodTxns.slice(0, RECENT_LIMIT)}
            categories={categories}
            quickAdd={
              <QuickAddTransaction
                accounts={accounts}
                categories={categories}
                baseCurrency={baseCurrency}
                todayIso={todayIso}
                trigger={
                  <Button type="button" variant="ghost" size="sm">
                    <Plus aria-hidden="true" />
                    {t('recent.add')}
                  </Button>
                }
              />
            }
          />
        </div>
        <InsightsPlaceholder
          className="col-span-12 lg:col-span-5"
          title={t('insights.title')}
          soonLabel={t('insights.soon')}
          items={[
            t('insights.narrative'),
            t('insights.leakFinder'),
            t('insights.forecast'),
          ]}
        />
      </BandSection>
    </div>
  )
}

/** Resolve a (possibly missing) category row to a display label. */
function labelOf(
  category: CategoryRow | undefined,
  tDefaults: (key: string) => string
): string {
  return category ? categoryLabel(category, tDefaults) : ''
}
