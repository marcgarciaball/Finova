import type { DebtType } from '@finova/domain/debts/types'
import { format, money } from '@finova/domain/money'
import { getLocale, getTranslations } from 'next-intl/server'
import { DonutChart } from '@/components/charts/DonutChart'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { GlassCard } from '@/components/ui/GlassCard'
import { DebtsSortBar } from './DebtsSortBar'
import type { DebtRowView } from './DebtsTable'
import { DebtsTable } from './DebtsTable'
import type { DebtsOverview as DebtsOverviewData } from './data'
import type { DebtSort } from './sort'

const STATUS_VARIANT: Record<string, 'pos' | 'neutral' | 'neg'> = {
  active: 'pos',
  paid_off: 'neutral',
  defaulted: 'neg',
}

/**
 * Debt totals band: per-currency totals (never summed across currencies) plus
 * a by-type donut for the primary currency, and the full sortable table.
 * Mirrors ManualAssetsOverviewSection/RealEstateOverviewSection.
 */
export async function DebtsOverviewSection({
  overview,
  sort,
}: {
  overview: DebtsOverviewData
  sort: DebtSort | null
}) {
  const [t, locale] = await Promise.all([getTranslations('debts'), getLocale()])
  const { debts, totals } = overview

  if (debts.length === 0) {
    return (
      <GlassCard className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="font-semibold text-ink">{t('empty.title')}</p>
        <p className="text-ink-soft text-sm">{t('empty.body')}</p>
      </GlassCard>
    )
  }

  const fmt = (cents: number, ccy: string) => format(money(cents, ccy), locale)

  // Primary currency for the donut: the one with the largest outstanding total.
  const primary = [...totals].sort(
    (a, b) => b.totalOutstandingCents - a.totalOutstandingCents
  )[0]

  const monthlyPaymentByCurrency = new Map<string, number>()
  for (const debt of debts) {
    if (debt.status === 'paid_off') {
      continue
    }
    monthlyPaymentByCurrency.set(
      debt.currency,
      (monthlyPaymentByCurrency.get(debt.currency) ?? 0) + debt.payment_cents
    )
  }

  const donutData = primary
    ? Object.entries(primary.outstandingByType).map(([type, cents]) => ({
        name: t(`types.${type as DebtType}`),
        value: cents ?? 0,
      }))
    : []

  const rawRows: DebtRowView[] = debts.map((debt) => ({
    debt,
    lenderName: debt.lender,
    outstandingCents: debt.outstanding_cents,
    outstandingLabel: fmt(debt.outstanding_cents, debt.currency),
    paymentCents: debt.payment_cents,
    paymentLabel: fmt(debt.payment_cents, debt.currency),
    ratePct: debt.interest_rate_pct,
    rateLabel: `${debt.interest_rate_pct.toFixed(2)}%`,
    statusLabel: t(`statuses.${debt.status}`),
    statusVariant: STATUS_VARIANT[debt.status] ?? 'neutral',
    typeLabel: t(`types.${debt.type}`),
  }))
  const rows = sortRows(rawRows, sort)

  return (
    <div className="flex flex-col gap-8">
      {totals.map((totalsRow) => (
        <section key={totalsRow.currency} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-lg">
              {t('overview.totalsTitle', { currency: totalsRow.currency })}
            </h2>
            <span className="text-ink-soft text-sm">
              {t('overview.debtCount', { count: totalsRow.debtCount })}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <KpiCard
              label={t('overview.totalOutstanding')}
              value={totalsRow.totalOutstandingCents}
              currency={totalsRow.currency}
              locale={locale}
            />
            <KpiCard
              label={t('overview.monthlyPayments')}
              value={monthlyPaymentByCurrency.get(totalsRow.currency) ?? 0}
              currency={totalsRow.currency}
              locale={locale}
            />
          </div>
        </section>
      ))}

      {donutData.length > 0 ? (
        <GlassCard className="flex flex-col gap-4">
          <h3 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
            {t('overview.byType')} · {primary?.currency}
          </h3>
          <DonutChart data={donutData} />
        </GlassCard>
      ) : null}

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-lg">{t('overview.debtsTitle')}</h2>
          <DebtsSortBar sort={sort} />
        </div>
        <GlassCard className="overflow-x-auto">
          <DebtsTable
            rows={rows}
            labels={{
              lender: t('tables.lender'),
              type: t('tables.type'),
              outstanding: t('tables.outstanding'),
              rate: t('tables.rate'),
              payment: t('tables.payment'),
              status: t('tables.status'),
            }}
          />
        </GlassCard>
      </section>
    </div>
  )
}

function sortRows(rows: DebtRowView[], sort: DebtSort | null): DebtRowView[] {
  if (!sort) {
    return rows
  }
  const value = (r: DebtRowView) => {
    switch (sort.field) {
      case 'lender':
        return r.lenderName
      case 'type':
        return r.typeLabel
      case 'outstanding':
        return r.outstandingCents
      case 'rate':
        return r.ratePct
      case 'payment':
        return r.paymentCents
    }
  }
  const sorted = [...rows].sort((a, b) => {
    const av = value(a)
    const bv = value(b)
    return typeof av === 'string' && typeof bv === 'string'
      ? av.localeCompare(bv)
      : (av as number) - (bv as number)
  })
  return sort.dir === 'asc' ? sorted : sorted.reverse()
}
