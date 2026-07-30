import { format, money } from '@finova/domain/money'
import { getLocale, getTranslations } from 'next-intl/server'
import { DonutChart } from '@/components/charts/DonutChart'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { GlassCard } from '@/components/ui/GlassCard'
import { HoldingsTable } from './HoldingsTable'
import { InvestmentsHistoryChart } from './InvestmentsHistoryChart'
import type { InvestmentsOverview } from './overview-data'
import { RefreshPricesButton } from './RefreshPricesButton'

const pct = (v: number | null) =>
  v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
const plClass = (v: number | null) =>
  v === null ? 'text-ink-soft' : v >= 0 ? 'text-pos' : 'text-neg'

/**
 * Portfolio overview band (Inversiones Phase B): KPI row, allocation donuts,
 * holdings table with data-freshness signals. Dividends arrive with Phase C
 * (no free data source yet); the evolution chart once snapshots accumulate.
 */
export async function InvestmentsOverviewSection({
  overview,
}: {
  overview: InvestmentsOverview
}) {
  const [t, locale] = await Promise.all([
    getTranslations('investments'),
    getLocale(),
  ])
  const { baseCurrency, holdings, totals } = overview

  if (!overview.hasTransactions) {
    return null // the transactions empty-state already invites the first add
  }

  const fmt = (cents: number, ccy = baseCurrency) =>
    format(money(cents, ccy), locale)

  const donut = (byKey: Record<string, number>, label: (k: string) => string) =>
    Object.entries(byKey).map(([key, fraction]) => ({
      name: label(key),
      value: Math.round((totals.totalValueCents * fraction) / 100),
    }))

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-lg">{t('overview.title')}</h2>
        <RefreshPricesButton />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={`${t('overview.value')} · ${baseCurrency}`}
          value={totals.totalValueCents}
          currency={baseCurrency}
          locale={locale}
        />
        <KpiCard
          label={t('overview.invested')}
          value={totals.totalInvestedCents}
          currency={baseCurrency}
          locale={locale}
          footnote={
            overview.creditFundedCents > 0
              ? t('overview.creditFunded', {
                  amount: fmt(overview.creditFundedCents),
                })
              : undefined
          }
        />
        <KpiCard
          label={t('overview.unrealized')}
          value={totals.totalPlCents}
          currency={baseCurrency}
          locale={locale}
          delta={
            totals.totalPlPct === null
              ? undefined
              : Math.round(totals.totalPlPct * 10) / 10
          }
          deltaSuffix="%"
        />
        <KpiCard
          label={t('overview.realized')}
          value={overview.realizedPlBaseCents}
          currency={baseCurrency}
          locale={locale}
        />
      </div>

      <p className="text-ink-soft text-xs">
        {t('overview.fxNote', { base: baseCurrency })}
      </p>

      {overview.history.length > 0 ? (
        <GlassCard>
          <InvestmentsHistoryChart
            baseCurrency={baseCurrency}
            history={overview.history}
            trades={overview.trades}
          />
        </GlassCard>
      ) : null}

      {totals.totalValueCents > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <GlassCard className="flex flex-col gap-2">
            <p className="text-ink-soft text-sm">{t('overview.byType')}</p>
            <DonutChart
              data={donut(totals.allocationByType, (k) =>
                t(`search.types.${k}`)
              )}
            />
          </GlassCard>
          <GlassCard className="flex flex-col gap-2">
            <p className="text-ink-soft text-sm">{t('overview.byCurrency')}</p>
            <DonutChart data={donut(totals.allocationByCurrency, (k) => k)} />
          </GlassCard>
        </div>
      ) : null}

      <GlassCard className="flex flex-col gap-3 overflow-x-auto">
        <p className="text-ink-soft text-sm">{t('overview.holdings')}</p>
        <HoldingsTable
          rows={holdings.map((h) => ({
            assetId: h.assetId,
            avgCostCents: h.avgCostCents,
            avgCostDisplay: fmt(h.avgCostCents, h.currency),
            currentPriceCents: h.currentPriceCents,
            currentValueCents: h.currentValueCents,
            name: h.name,
            plClassName: plClass(h.unrealizedPlCents),
            plDisplay:
              h.unrealizedPlCents === null
                ? null
                : `${fmt(h.unrealizedPlCents, h.currency)} (${pct(h.unrealizedPlPct)})`,
            priceDisplay:
              h.currentPriceCents === null
                ? null
                : fmt(h.currentPriceCents, h.currency),
            quantity: h.quantity,
            stale: h.stale,
            staleLabel: t('overview.stale'),
            ticker: h.ticker,
            unpricedLabel: t('overview.unpriced'),
            unrealizedPlCents: h.unrealizedPlCents,
            valueDisplay:
              h.currentValueCents === null
                ? null
                : fmt(h.currentValueCents, h.currency),
          }))}
          labels={{
            asset: t('list.asset'),
            avgCost: t('overview.avgCost'),
            pl: t('overview.pl'),
            price: t('overview.price'),
            quantity: t('list.quantity'),
            value: t('overview.value'),
          }}
        />
        <p className="text-ink-soft text-xs">
          {overview.latestFetchedAt
            ? t('overview.updated', {
                time: new Date(overview.latestFetchedAt).toLocaleString(locale),
              })
            : t('overview.neverUpdated')}
          {overview.unpricedCount > 0 || overview.unconvertibleCount > 0
            ? ` · ${t('overview.partial')}`
            : ''}
        </p>
      </GlassCard>
    </section>
  )
}
