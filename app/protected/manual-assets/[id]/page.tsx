import { format, money } from '@finova/domain/money'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { Badge } from '@/components/ui/Badge'
import { GlassCard } from '@/components/ui/GlassCard'
import { requireUser } from '@/lib/auth/require-user'
import { getDateFormatter } from '@/lib/i18n/date-formatter'
import { deleteManualAssetIncome, deleteManualAssetValuation } from '../actions'
import { getManualAssetDetail } from '../data'
import { AssetActions } from './AssetActions'
import { AddIncomeButton, AddValuationButton } from './EntryForms'
import { IncomeTable } from './IncomeTable'
import { ValuationChart } from './ValuationChart'
import { ValuationsTable } from './ValuationsTable'

export default async function ManualAssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireUser()
  const { id } = await params
  const detail = await getManualAssetDetail(id)
  if (!detail) {
    notFound()
  }
  const [t, locale] = await Promise.all([
    getTranslations('manualAssets'),
    getLocale(),
  ])
  const todayIso = new Date().toISOString().slice(0, 10)
  const { asset, income, valuations } = detail
  const ccy = asset.currency
  const fmt = (cents: number) => format(money(cents, ccy), locale)
  const dateFmt = getDateFormatter(locale, { dateStyle: 'medium' })
  const fmtDate = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`))
  const gainLossCents = asset.current_value_cents - asset.cost_basis_cents

  const chartPoints = [...valuations]
    .sort((a, b) => a.valuation_date.localeCompare(b.valuation_date))
    .map((v) => ({ date: v.valuation_date, valueCents: v.value_cents }))

  const valuationRows = valuations.map((v) => ({
    id: v.id,
    valuationDate: v.valuation_date,
    dateLabel: fmtDate(v.valuation_date),
    valueCents: v.value_cents,
    valueLabel: fmt(v.value_cents),
    sourceLabel: t(`valuationForm.sources.${v.source ?? 'manual'}`),
  }))

  const incomeRows = income.map((i) => ({
    id: i.id,
    receivedDate: i.received_date,
    dateLabel: fmtDate(i.received_date),
    amountCents: i.amount_cents,
    amountLabel: fmt(i.amount_cents),
  }))

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <Link
        href="/protected/manual-assets"
        className="flex items-center gap-1.5 text-ink-soft text-sm hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('detail.back')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-2xl">{asset.name}</h1>
            {asset.is_closed ? (
              <Badge variant="neutral">{t('card.closed')}</Badge>
            ) : null}
          </div>
          <p className="text-ink-soft text-sm">
            {t(`types.${asset.type}`)}
            {' · '}
            {t('detail.acquiredOn', { date: fmtDate(asset.acquisition_date) })}
          </p>
        </div>
        <AssetActions asset={asset} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label={t('detail.currentValue')}
          value={asset.current_value_cents}
          currency={ccy}
          locale={locale}
        />
        <KpiCard
          label={t('detail.costBasis')}
          value={asset.cost_basis_cents}
          currency={ccy}
          locale={locale}
        />
        <KpiCard
          label={t('detail.gainLoss')}
          value={gainLossCents}
          currency={ccy}
          locale={locale}
        />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-lg">
            {t('detail.valuationsTitle')}
          </h2>
          <AddValuationButton manualAssetId={asset.id} todayIso={todayIso} />
        </div>
        <GlassCard>
          {chartPoints.length > 1 ? (
            <ValuationChart
              currency={ccy}
              points={chartPoints}
              title={t('detail.currentValue')}
            />
          ) : (
            <p className="text-ink-soft text-sm">{t('detail.empty')}</p>
          )}
          {valuations.length > 0 ? (
            <ValuationsTable
              rows={valuationRows}
              labels={{
                date: t('tables.date'),
                value: t('tables.value'),
                source: t('tables.source'),
              }}
              deleteAction={deleteManualAssetValuation}
            />
          ) : null}
        </GlassCard>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-lg">{t('detail.incomeTitle')}</h2>
          <AddIncomeButton manualAssetId={asset.id} todayIso={todayIso} />
        </div>
        <GlassCard>
          {income.length > 0 ? (
            <IncomeTable
              rows={incomeRows}
              labels={{ date: t('tables.date'), amount: t('tables.amount') }}
              deleteAction={deleteManualAssetIncome}
            />
          ) : (
            <p className="text-ink-soft text-sm">{t('detail.incomeEmpty')}</p>
          )}
        </GlassCard>
      </section>
    </div>
  )
}
