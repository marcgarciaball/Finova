import { getLocale, getTranslations } from 'next-intl/server'
import { AreaChart } from '@/components/charts/AreaChart'
import { BarChart } from '@/components/charts/BarChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { HeroCard } from '@/components/dashboard/HeroCard'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { GlassCard } from '@/components/ui/GlassCard'
import { categoryLabel } from '@/lib/domain/categories/label'
import {
  accountBalances,
  balanceTrend,
  balanceTrendToArea,
  filterByPeriod,
  monthlySeries,
  monthlySeriesToBars,
  parsePeriod,
  periodStartIso,
  pickDisplayCurrency,
  savingsRate,
  spendingByCategory,
  spendingToDonut,
  totalBalanceByCurrency,
} from '@/lib/domain/dashboard'
import { format, money } from '@/lib/domain/money'
import { summarizeByCurrency } from '@/lib/domain/transactions/totals'
import type { CategoryRow } from '@/lib/validation/category'
import { DashboardEmptyState } from './DashboardEmptyState'
import { getDashboardData } from './data'
import { PeriodSelector } from './PeriodSelector'
import { RecentTransactions } from './RecentTransactions'

const RECENT_LIMIT = 8

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
  const fmt = (n: number) => format(money(Math.round(n), currency), locale)

  // Period-sensitive figures (cash flow, spending) use the sliced set;
  // balances + trend are cumulative and use the full history.
  const periodTxns = filterByPeriod(txns, period, todayIso)
  const totals = summarizeByCurrency(periodTxns)[currency] ?? {
    income: 0,
    expense: 0,
    net: 0,
  }
  const rate = savingsRate(totals)

  const balanceAccounts = accounts.map((a) => ({
    id: a.id,
    currency: a.currency,
    opening_balance: a.opening_balance,
  }))
  const balances = accountBalances(balanceAccounts, txns)
  const totalByCurrency = totalBalanceByCurrency(balances)
  const totalBalance = totalByCurrency[currency] ?? 0

  // Trend opening = balance carried into the period start (full history before it).
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
  const netSparkline = months.map((m) => m.net / 100)

  const spend = spendingByCategory(periodTxns)[currency] ?? []
  const byId = new Map(categories.map((c) => [c.id, c] as const))
  const labelFor = (categoryId: string | null): string =>
    categoryId === null
      ? t('table.uncategorized')
      : labelOf(byId.get(categoryId), tDefaults)
  const donut = spendingToDonut(spend, labelFor)

  const currencyCount = new Set(txns.map((x) => x.currency)).size

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-bold text-2xl">{t('title')}</h1>
        <PeriodSelector value={period} />
      </div>

      {currencyCount > 1 && (
        <p className="text-ink-soft text-sm">
          {t('otherCurrencies', { currency })}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <HeroCard
          className="lg:col-span-2"
          label={`${t('kpi.net')} · ${currency}`}
          value={totals.net}
          format={fmt}
          trend={netSparkline}
        />
        <KpiCard label={t('kpi.income')} value={totals.income} format={fmt} />
        <KpiCard label={t('kpi.expense')} value={totals.expense} format={fmt} />
        <KpiCard
          className="lg:col-span-2"
          label={`${t('kpi.totalBalance')} · ${currency}`}
          value={totalBalance}
          format={fmt}
        />
        <GlassCard className="flex flex-col gap-2 lg:col-span-2">
          <span className="font-medium text-ink-soft text-xs uppercase tracking-wide">
            {t('kpi.savingsRate')}
          </span>
          <span className="font-bold font-display text-4xl text-ink tabular-nums tracking-tight">
            {rate === null
              ? '—'
              : `${(rate * 100).toLocaleString(locale, {
                  maximumFractionDigits: 1,
                })}%`}
          </span>
          <span className="text-ink-soft text-xs">
            {t('kpi.savingsRateNote')}
          </span>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GlassCard className="flex flex-col gap-4">
          <h2 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
            {t('charts.incomeVsExpense')}
          </h2>
          <BarChart
            index={bars.index}
            categories={bars.categories}
            data={bars.data}
          />
        </GlassCard>
        <GlassCard className="flex flex-col gap-4">
          <h2 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
            {t('charts.balanceTrend')}
          </h2>
          <AreaChart
            index={area.index}
            categories={area.categories}
            data={area.data}
          />
        </GlassCard>
      </div>

      {donut.length > 0 && (
        <GlassCard className="flex flex-col gap-4">
          <h2 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
            {t('charts.spendingByCategory')}
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DonutChart data={donut} />
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-soft text-xs uppercase">
                  <th className="py-2 text-left font-medium">
                    {t('table.category')}
                  </th>
                  <th className="py-2 text-right font-medium">
                    {t('table.amount')}
                  </th>
                  <th className="py-2 text-right font-medium">
                    {t('table.share')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {spend.map((s) => (
                  <tr
                    key={s.categoryId ?? '__uncategorized__'}
                    className="border-glass-line border-t"
                  >
                    <td className="py-2 text-ink">{labelFor(s.categoryId)}</td>
                    <td className="py-2 text-right text-ink tabular-nums">
                      {format(money(s.total, currency), locale)}
                    </td>
                    <td className="py-2 text-right text-ink-soft tabular-nums">
                      {(s.share * 100).toLocaleString(locale, {
                        maximumFractionDigits: 1,
                      })}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentTransactions
          txns={periodTxns.slice(0, RECENT_LIMIT)}
          categories={categories}
        />
        <GlassCard className="flex flex-col gap-3">
          <h2 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
            {t('balances.title')}
          </h2>
          <ul className="flex flex-col">
            {balances.map((b) => {
              const account = accounts.find((a) => a.id === b.accountId)
              return (
                <li
                  key={b.accountId}
                  className="flex items-center justify-between gap-3 border-glass-line border-b py-2 text-sm last:border-b-0"
                >
                  <span className="truncate text-ink">
                    {account?.name ?? b.accountId}
                  </span>
                  <span className="font-medium text-ink tabular-nums">
                    {format(money(b.balance, b.currency), locale)}
                  </span>
                </li>
              )
            })}
          </ul>
        </GlassCard>
      </div>
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
