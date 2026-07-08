import {
  Building,
  Building2,
  Home,
  LandPlot,
  Palmtree,
  Store,
} from 'lucide-react'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { HeroCard } from '@/components/dashboard/HeroCard'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { Badge } from '@/components/ui/Badge'
import { GlassCard } from '@/components/ui/GlassCard'
import { format, money } from '@/lib/domain/money'
import type { PropertyType } from '@/lib/domain/real-estate/types'
import type { PropertyOverview, RealEstateOverview } from './data'
import { rentBreakdown } from './data'

const TYPE_ICONS: Record<PropertyType, typeof Home> = {
  commercial: Store,
  investment: Building2,
  land: LandPlot,
  other: Building,
  primary_home: Home,
  vacation: Palmtree,
}

function pct(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(1)}%`
}

/**
 * Portfolio band: per-currency totals (never summed across currencies), the
 * rental income run-rate, and one card per property linking to its detail.
 */
export async function RealEstateOverviewSection({
  overview,
}: {
  overview: RealEstateOverview
}) {
  const [t, locale] = await Promise.all([
    getTranslations('realEstate'),
    getLocale(),
  ])
  const { properties, totals } = overview

  if (properties.length === 0) {
    return (
      <GlassCard className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="font-semibold text-ink">{t('empty.title')}</p>
        <p className="text-ink-soft text-sm">{t('empty.body')}</p>
      </GlassCard>
    )
  }

  const fmt = (cents: number, ccy: string) => format(money(cents, ccy), locale)

  // Rental run-rate per currency, active properties only.
  const rentByCurrency = new Map<string, number>()
  for (const { property, metrics } of properties) {
    if (property.is_sold || metrics.annualRentCents === 0) {
      continue
    }
    rentByCurrency.set(
      property.currency,
      (rentByCurrency.get(property.currency) ?? 0) + metrics.annualRentCents
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {totals.map((totalsRow) => (
        <section key={totalsRow.currency} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-lg">
              {t('overview.totalsTitle', { currency: totalsRow.currency })}
            </h2>
            <span className="text-ink-soft text-sm">
              {t('overview.propertyCount', { count: totalsRow.propertyCount })}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <HeroCard
              label={t('overview.equity')}
              value={totalsRow.equityCents}
              currency={totalsRow.currency}
              locale={locale}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard
                label={t('overview.value')}
                value={totalsRow.valueCents}
                currency={totalsRow.currency}
                locale={locale}
              />
              <KpiCard
                label={t('overview.debt')}
                value={totalsRow.debtCents}
                currency={totalsRow.currency}
                locale={locale}
              />
              <KpiCard
                label={t('overview.netProfit')}
                value={totalsRow.netProfitCents}
                currency={totalsRow.currency}
                locale={locale}
              />
            </div>
          </div>
        </section>
      ))}

      {[...rentByCurrency.entries()].map(([currency, annualCents]) => {
        const rent = rentBreakdown(annualCents)
        return (
          <section key={currency} className="flex flex-col gap-4">
            <h2 className="font-semibold text-lg">
              {t('overview.rentTitle', { currency })}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard
                label={t('overview.rentPerDay')}
                value={rent.perDayCents}
                currency={currency}
                locale={locale}
              />
              <KpiCard
                label={t('overview.rentPerMonth')}
                value={rent.perMonthCents}
                currency={currency}
                locale={locale}
              />
              <KpiCard
                label={t('overview.rentPerYear')}
                value={rent.perYearCents}
                currency={currency}
                locale={locale}
              />
            </div>
          </section>
        )
      })}

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold text-lg">
          {t('overview.propertiesTitle')}
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {properties.map((p) => (
            <PropertyCard
              key={p.property.id}
              overview={p}
              typeLabel={t(`types.${p.property.type}`)}
              labels={{
                cashFlow: t('card.cashFlow'),
                equity: t('card.equity'),
                grossYield: t('card.grossYield'),
                ltv: t('card.ltv'),
                netYield: t('card.netYield'),
                rented: t('card.rented'),
                roi: t('card.roi'),
                sold: t('card.sold'),
                value: t('card.value'),
              }}
              fmt={fmt}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function PropertyCard({
  overview,
  typeLabel,
  labels,
  fmt,
}: {
  overview: PropertyOverview
  typeLabel: string
  labels: Record<
    | 'cashFlow'
    | 'equity'
    | 'grossYield'
    | 'ltv'
    | 'netYield'
    | 'rented'
    | 'roi'
    | 'sold'
    | 'value',
    string
  >
  fmt: (cents: number, ccy: string) => string
}) {
  const { property, metrics } = overview
  const Icon = TYPE_ICONS[property.type]
  const ccy = property.currency
  const location = [property.city, property.country].filter(Boolean).join(', ')

  const stats: { label: string; value: string; tone?: 'pos' | 'neg' }[] = [
    { label: labels.value, value: fmt(property.current_value_cents, ccy) },
    {
      label: labels.equity,
      value: fmt(metrics.equityCents, ccy),
      tone: metrics.equityCents >= 0 ? 'pos' : 'neg',
    },
    { label: labels.ltv, value: pct(metrics.ltvPct) },
    { label: labels.grossYield, value: pct(metrics.grossYieldPct) },
    { label: labels.netYield, value: pct(metrics.netYieldPct) },
    {
      label: labels.cashFlow,
      value: fmt(metrics.monthlyCashFlowCents, ccy),
      tone: metrics.monthlyCashFlowCents >= 0 ? 'pos' : 'neg',
    },
    { label: labels.roi, value: pct(metrics.roiPct) },
  ]

  return (
    <Link
      href={`/protected/real-estate/${property.id}`}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <GlassCard hoverable className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col">
              <span className="font-semibold text-ink">{property.name}</span>
              <span className="text-ink-soft text-xs">
                {typeLabel}
                {location ? ` · ${location}` : ''}
              </span>
            </div>
          </div>
          <div className="flex gap-1.5">
            {property.is_sold ? (
              <Badge variant="neutral">{labels.sold}</Badge>
            ) : null}
            {property.is_rented && !property.is_sold ? (
              <Badge variant="pos">{labels.rented}</Badge>
            ) : null}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col">
              <dt className="text-ink-soft text-xs">{s.label}</dt>
              <dd
                className={`font-medium text-sm ${
                  s.tone === 'pos'
                    ? 'text-pos'
                    : s.tone === 'neg'
                      ? 'text-neg'
                      : 'text-ink'
                }`}
              >
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </GlassCard>
    </Link>
  )
}
