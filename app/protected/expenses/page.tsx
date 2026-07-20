import { categoryLabel } from '@finova/domain/categories/label'
import {
  filterByPeriod,
  incomeExpenseSeries,
  keyStats,
  monthlySeriesToBars,
  parseGranularity,
  parsePeriod,
  pickDisplayCurrency,
  spendingByCategory,
  spendingByMerchant,
  spendingToDonut,
  topExpenses,
} from '@finova/domain/dashboard'
import { format, money } from '@finova/domain/money'
import { getLocale, getTranslations } from 'next-intl/server'
import { BarChart } from '@/components/charts/BarChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { CategoryIcon } from '@/components/dashboard/CategoryIcon'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { GlassCard } from '@/components/ui/GlassCard'
import type { CategoryRow } from '@/lib/validation/category'
import { getDashboardData } from '../data'
import { GranularitySelector } from '../GranularitySelector'
import { PeriodSelector } from '../PeriodSelector'
import { type RankRow, SpendingRanking } from '../SpendingRanking'

const MERCHANT_LIMIT = 10
const BIGGEST_LIMIT = 8

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ granularity?: string; period?: string }>
}) {
  const t = await getTranslations('expenses')
  const tDefaults = await getTranslations('categories.defaults')
  const locale = await getLocale()

  const { categories, txns, baseCurrency } = await getDashboardData()
  const params = await searchParams
  const period = parsePeriod(params.period)
  const granularity = parseGranularity(params.granularity)
  const todayIso = new Date().toISOString().slice(0, 10)
  const currency = pickDisplayCurrency(txns, baseCurrency)
  const periodTxns = filterByPeriod(txns, period, todayIso)

  if (txns.length === 0) {
    return (
      <div className="flex w-full flex-1 flex-col gap-6">
        <h1 className="font-bold text-2xl">{t('title')}</h1>
        <p className="text-ink-soft">{t('empty')}</p>
      </div>
    )
  }

  const byId = new Map(categories.map((c) => [c.id, c] as const))
  const labelFor = (categoryId: string | null): string =>
    categoryId === null
      ? t('uncategorized')
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
  const donut = spendingToDonut(spend, labelFor, colorFor)
  const categoryRanking: RankRow[] = spend.map((s) => ({
    key: s.categoryId ?? '__uncategorized__',
    label: labelFor(s.categoryId),
    icon: iconFor(s.categoryId),
    total: s.total,
    share: s.share,
    currency,
  }))

  const merchants = (spendingByMerchant(periodTxns)[currency] ?? []).slice(
    0,
    MERCHANT_LIMIT
  )
  const merchantRanking: RankRow[] = merchants.map((m) => ({
    key: m.merchant,
    label: m.merchant,
    total: m.total,
    share: m.share,
    currency,
  }))

  const stats = keyStats(periodTxns)[currency] ?? {
    averageSpend: null,
    biggestExpense: null,
    busiestDay: null,
    count: 0,
  }
  const totalSpend = spend.reduce((sum, s) => sum + s.total, 0)
  const expenseCount = spend.reduce((sum, s) => sum + s.count, 0)
  const uncategorizedCents =
    spend.find((s) => s.categoryId === null)?.total ?? 0
  const uncategorizedShare =
    totalSpend === 0 ? 0 : Math.round((uncategorizedCents / totalSpend) * 100)

  const months = incomeExpenseSeries(periodTxns, granularity)[currency] ?? []
  const bars = monthlySeriesToBars(months)

  const biggest = (topExpenses(periodTxns, BIGGEST_LIMIT)[currency] ?? []).map(
    (e) => {
      const txn = periodTxns.find((x) => x.id === e.id)
      return { ...e, categoryId: txn?.category_id ?? null }
    }
  )

  return (
    <div className="flex w-full flex-1 flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-bold text-2xl">{t('title')}</h1>
        <PeriodSelector value={period} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-4">
        <KpiCard
          label={t('kpi.total')}
          value={totalSpend}
          currency={currency}
          locale={locale}
        />
        <KpiCard
          label={t('kpi.average')}
          value={stats.averageSpend ?? 0}
          currency={currency}
          locale={locale}
          empty={stats.averageSpend === null}
        />
        <KpiCard label={t('kpi.count')} value={expenseCount} />
        <KpiCard
          label={t('kpi.uncategorized')}
          value={uncategorizedShare}
          suffix="%"
        />
      </div>

      <div className="grid grid-cols-12 gap-4 md:gap-5">
        <GlassCard className="col-span-12 flex flex-col gap-4 lg:col-span-5">
          <h3 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
            {t('charts.byCategory')}
          </h3>
          {donut.length === 0 ? (
            <p className="text-ink-soft text-sm">{t('empty')}</p>
          ) : (
            <DonutChart data={donut} />
          )}
        </GlassCard>
        <SpendingRanking
          className="col-span-12 lg:col-span-7"
          title={t('ranking.byCategory')}
          rows={categoryRanking}
          locale={locale}
          emptyLabel={t('empty')}
          limit={categoryRanking.length}
        />

        <SpendingRanking
          className="col-span-12 lg:col-span-6"
          title={t('ranking.byMerchant')}
          rows={merchantRanking}
          locale={locale}
          emptyLabel={t('empty')}
          limit={MERCHANT_LIMIT}
        />
        <GlassCard className="col-span-12 flex flex-col gap-4 lg:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
              {t('charts.trend')}
            </h3>
            <GranularitySelector value={granularity} />
          </div>
          <BarChart
            index={bars.index}
            categories={['expense']}
            data={bars.data}
          />
        </GlassCard>

        <GlassCard className="col-span-12 flex flex-col gap-4">
          <h3 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
            {t('biggest.title')}
          </h3>
          {biggest.length === 0 ? (
            <p className="text-ink-soft text-sm">{t('empty')}</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {biggest.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2 text-ink">
                    {iconFor(e.categoryId)}
                    <span className="truncate">{e.description}</span>
                    <span className="shrink-0 text-ink-soft text-xs">
                      {new Date(e.occurredAt).toLocaleDateString(locale)}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium text-ink tabular-nums">
                    {format(money(e.amountCents, currency), locale)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </GlassCard>
      </div>
    </div>
  )
}

function labelOf(
  category: CategoryRow | undefined,
  tDefaults: (key: string) => string
): string {
  return category ? categoryLabel(category, tDefaults) : ''
}
