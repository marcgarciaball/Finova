import { getLocale, getTranslations } from 'next-intl/server'
import { BarChart } from '@/components/charts/BarChart'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { GlassCard } from '@/components/ui/GlassCard'
import { format, money } from '@/lib/domain/money'
import type { InvestmentsIncome } from './income-data'

/**
 * Dividend income tab (Inversiones Phase C): received, forward estimate,
 * yield on cost, per-year chart, upcoming payments, per-asset breakdown.
 */
export async function IncomeSection({ income }: { income: InvestmentsIncome }) {
  const [t, locale] = await Promise.all([
    getTranslations('investments'),
    getLocale(),
  ])
  const base = income.baseCurrency
  const fmt = (cents: number, ccy = base) => format(money(cents, ccy), locale)

  if (!income.hasEvents) {
    return (
      <GlassCard>
        <p className="text-ink-soft text-sm">{t('income.empty')}</p>
      </GlassCard>
    )
  }

  const yearLabel = t('income.received')

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label={`${t('income.totalReceived')} · ${base}`}
          value={income.totalReceivedBaseCents}
          currency={base}
          locale={locale}
        />
        <KpiCard
          label={t('income.forwardAnnual')}
          value={income.forwardAnnualBaseCents}
          currency={base}
          locale={locale}
          footnote={t('income.forwardNote')}
        />
        <KpiCard
          label={t('income.yieldOnCost')}
          value={
            income.portfolioYieldOnCostPct === null
              ? 0
              : Math.round(income.portfolioYieldOnCostPct * 10) / 10
          }
          empty={income.portfolioYieldOnCostPct === null}
          emptyDisplay="—"
          suffix="%"
          locale={locale}
        />
      </div>

      {income.byYearBaseCents.length > 0 ? (
        <GlassCard className="flex flex-col gap-2">
          <p className="text-ink-soft text-sm">{t('income.byYear')}</p>
          <BarChart
            index="year"
            categories={[yearLabel]}
            data={income.byYearBaseCents.map((y) => ({
              year: y.year,
              [yearLabel]: Math.round(y.cents / 100),
            }))}
          />
        </GlassCard>
      ) : null}

      {income.upcoming.length > 0 ? (
        <GlassCard className="flex flex-col gap-3">
          <p className="text-ink-soft text-sm">{t('income.upcoming')}</p>
          <table className="w-full text-sm">
            <tbody>
              {income.upcoming.map((u) => (
                <tr
                  key={`${u.ticker}-${u.payDate}`}
                  className="border-glass-line border-t first:border-t-0"
                >
                  <td className="py-2 pr-4 text-ink-soft">{u.payDate}</td>
                  <td className="py-2 pr-4 font-medium text-ink">{u.ticker}</td>
                  <td className="py-2 text-right text-pos">
                    {fmt(u.estimatedCents, u.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      ) : null}

      <GlassCard className="flex flex-col gap-3 overflow-x-auto">
        <p className="text-ink-soft text-sm">{t('income.perAsset')}</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-soft">
              <th className="py-2 pr-4 font-medium">{t('list.asset')}</th>
              <th className="py-2 pr-4 text-right font-medium">
                {t('income.received')}
              </th>
              <th className="py-2 pr-4 text-right font-medium">
                {t('income.perShare12m')}
              </th>
              <th className="py-2 pr-4 text-right font-medium">
                {t('income.forwardAnnual')}
              </th>
              <th className="py-2 text-right font-medium">
                {t('income.yieldOnCost')}
              </th>
            </tr>
          </thead>
          <tbody>
            {income.perAsset.map((a) => (
              <tr key={a.ticker} className="border-glass-line border-t">
                <td className="py-2 pr-4">
                  <span className="font-medium text-ink">{a.ticker}</span>
                  <span className="text-ink-soft"> · {a.name}</span>
                </td>
                <td className="py-2 pr-4 text-right text-ink">
                  {fmt(a.receivedCents, a.currency)}
                </td>
                <td className="py-2 pr-4 text-right text-ink">
                  {fmt(a.trailing12mPerShareCents, a.currency)}
                </td>
                <td className="py-2 pr-4 text-right text-ink">
                  {fmt(a.forwardAnnualCents, a.currency)}
                </td>
                <td className="py-2 text-right text-ink">
                  {a.yieldOnCostPct === null
                    ? '—'
                    : `${a.yieldOnCostPct.toFixed(2)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  )
}
