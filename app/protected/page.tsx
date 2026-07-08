import { Plus } from 'lucide-react'
import { getLocale, getTranslations } from 'next-intl/server'
import { AreaChart } from '@/components/charts/AreaChart'
import { BarChart } from '@/components/charts/BarChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { CategoryIcon } from '@/components/dashboard/CategoryIcon'
import { HeroCard } from '@/components/dashboard/HeroCard'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { QuickAddTransaction } from '@/components/transactions/QuickAddTransaction'
import { Button } from '@/components/ui/Button'
import { GlassCard } from '@/components/ui/GlassCard'
import { categoryLabel } from '@/lib/domain/categories/label'
import {
  accountBalances,
  balanceTrend,
  balanceTrendToArea,
  filterByPeriod,
  keyStats,
  monthlySeries,
  monthlySeriesToBars,
  parsePeriod,
  pctChange,
  periodStartIso,
  pickDisplayCurrency,
  previousPeriodTxns,
  savingsRate,
  spendingByAccount,
  spendingByCategory,
  spendingToDonut,
  totalBalanceByCurrency,
  trendOf,
} from '@/lib/domain/dashboard'
import { summarizeByCurrency } from '@/lib/domain/transactions/totals'
import type { CategoryRow } from '@/lib/validation/category'
import { AccountsStrip } from './AccountsStrip'
import { BandSection } from './BandSection'
import { CategorizeEmptyState } from './CategorizeEmptyState'
import { CurrencyBreakdown } from './CurrencyBreakdown'
import { DashboardEmptyState } from './DashboardEmptyState'
import { DataHealthBanner } from './DataHealthBanner'
import { getDashboardData } from './data'
import { InsightsPlaceholder } from './InsightsPlaceholder'
import { getInvestmentsOverview } from './investments/overview-data'
import { KeyStatsStrip } from './KeyStatsStrip'
import { PeriodSelector } from './PeriodSelector'
import { RecentTransactions } from './RecentTransactions'
import { type RankRow, SpendingRanking } from './SpendingRanking'
import { WealthAllocation } from './WealthAllocation'

const RECENT_LIMIT = 6
const UNCATEGORIZED_THRESHOLD = 0.4

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const t = await getTranslations('dashboard')
  const tDefaults = await getTranslations('categories.defaults')
  const locale = await getLocale()

  const { accounts, categories, txns, baseCurrency } = await getDashboardData()
  const period = parsePeriod((await searchParams).period)

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

  const totals = summarizeByCurrency(periodTxns)[currency] ?? {
    income: 0,
    expense: 0,
    net: 0,
  }
  const prevTotals = summarizeByCurrency(prevTxns)[currency] ?? {
    income: 0,
    expense: 0,
    net: 0,
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
  const totalBalance = totalByCurrency[currency] ?? 0
  // Investment amounts only line up with cash when the portfolio's base
  // currency matches the dashboard's display currency.
  const investedByType =
    investments.baseCurrency === currency
      ? investments.totals.allocationByType
      : {}

  // Trend opening = balance carried into the period start (full history before).
  const start = periodStartIso(period, todayIso)
  const before = start
    ? txns.filter((x) => x.occurred_at.slice(0, 10) < start)
    : []
  const opening = totalBalanceByCurrency(
    accountBalances(balanceAccounts, before)
  )
  const trend = balanceTrend(periodTxns, opening)[currency] ?? []

  const months = monthlySeries(periodTxns)[currency] ?? []
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
          <h3 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
            {t('charts.incomeVsExpense')}
          </h3>
          <BarChart
            index={bars.index}
            categories={bars.categories}
            data={bars.data}
          />
        </GlassCard>
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
