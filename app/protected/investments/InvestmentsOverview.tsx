import { getLocale, getTranslations } from 'next-intl/server'
import { DonutChart } from '@/components/charts/DonutChart'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { GlassCard } from '@/components/ui/GlassCard'
import { format, money } from '@/lib/domain/money'
import type { InvestmentsOverview } from './overview-data'

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
  const pct = (v: number | null) =>
    v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
  const plClass = (v: number | null) =>
    v === null ? 'text-ink-soft' : v >= 0 ? 'text-pos' : 'text-neg'

  const donut = (byKey: Record<string, number>, label: (k: string) => string) =>
    Object.entries(byKey).map(([key, fraction]) => ({
      name: label(key),
      value: Math.round((totals.totalValueCents * fraction) / 100),
    }))

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-semibold text-lg">{t('overview.title')}</h2>

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
        />
        <KpiCard
          label={t('overview.unrealized')}
          value={totals.totalPlCents}
          currency={baseCurrency}
          locale={locale}
          delta={totals.totalPlPct ?? undefined}
          deltaSuffix="%"
        />
        <KpiCard
          label={t('overview.realized')}
          value={overview.realizedPlBaseCents}
          currency={baseCurrency}
          locale={locale}
        />
      </div>

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
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-soft">
              <th className="py-2 pr-4 font-medium">{t('list.asset')}</th>
              <th className="py-2 pr-4 text-right font-medium">
                {t('list.quantity')}
              </th>
              <th className="py-2 pr-4 text-right font-medium">
                {t('overview.avgCost')}
              </th>
              <th className="py-2 pr-4 text-right font-medium">
                {t('overview.price')}
              </th>
              <th className="py-2 pr-4 text-right font-medium">
                {t('overview.value')}
              </th>
              <th className="py-2 text-right font-medium">
                {t('overview.pl')}
              </th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <tr key={h.assetId} className="border-glass-line border-t">
                <td className="py-2 pr-4">
                  <span className="font-medium text-ink">
                    {h.ticker || h.name}
                  </span>
                  {h.ticker ? (
                    <span className="text-ink-soft"> · {h.name}</span>
                  ) : null}
                </td>
                <td className="py-2 pr-4 text-right text-ink">{h.quantity}</td>
                <td className="py-2 pr-4 text-right text-ink">
                  {fmt(h.avgCostCents, h.currency)}
                </td>
                <td className="py-2 pr-4 text-right text-ink">
                  {h.currentPriceCents === null ? (
                    <span className="text-ink-soft">
                      {t('overview.unpriced')}
                    </span>
                  ) : (
                    <>
                      {fmt(h.currentPriceCents, h.currency)}
                      {h.stale ? (
                        <span className="text-warn" title={t('overview.stale')}>
                          {' '}
                          •
                        </span>
                      ) : null}
                    </>
                  )}
                </td>
                <td className="py-2 pr-4 text-right text-ink">
                  {h.currentValueCents === null
                    ? '—'
                    : fmt(h.currentValueCents, h.currency)}
                </td>
                <td
                  className={`py-2 text-right ${plClass(h.unrealizedPlCents)}`}
                >
                  {h.unrealizedPlCents === null
                    ? '—'
                    : `${fmt(h.unrealizedPlCents, h.currency)} (${pct(h.unrealizedPlPct)})`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
