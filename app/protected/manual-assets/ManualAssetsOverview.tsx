import type { ManualAssetType } from '@finova/domain/manual-assets/types'
import { format, money } from '@finova/domain/money'
import { Coins, Gem, Landmark, Package, PiggyBank } from 'lucide-react'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { HeroCard } from '@/components/dashboard/HeroCard'
import { Badge } from '@/components/ui/Badge'
import { GlassCard } from '@/components/ui/GlassCard'
import type { ManualAssetsOverview } from './data'
import { ManualAssetsSortBar } from './ManualAssetsSortBar'
import type { ManualAssetSort } from './sort'

const TYPE_ICONS: Record<ManualAssetType, typeof Coins> = {
  bond: Landmark,
  collectible: Gem,
  other: Package,
  p2p_lending: PiggyBank,
  private_equity: Coins,
}

/**
 * Portfolio band: per-currency totals (never summed across currencies) and
 * one card per asset. Mirrors RealEstateOverviewSection, minus the parts
 * (loans/rent/yields) that don't apply to a manual-value catch-all.
 */
export async function ManualAssetsOverviewSection({
  overview,
  sort,
}: {
  overview: ManualAssetsOverview
  sort: ManualAssetSort | null
}) {
  const [t, locale] = await Promise.all([
    getTranslations('manualAssets'),
    getLocale(),
  ])
  const { totals } = overview
  const assets = sortAssets(overview.assets, sort)

  if (assets.length === 0) {
    return (
      <GlassCard className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="font-semibold text-ink">{t('empty.title')}</p>
        <p className="text-ink-soft text-sm">{t('empty.body')}</p>
      </GlassCard>
    )
  }

  const fmt = (cents: number, ccy: string) => format(money(cents, ccy), locale)

  return (
    <div className="flex flex-col gap-8">
      {totals.map((totalsRow) => (
        <section key={totalsRow.currency} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-lg">
              {t('overview.totalsTitle', { currency: totalsRow.currency })}
            </h2>
            <span className="text-ink-soft text-sm">
              {t('overview.assetCount', { count: totalsRow.assetCount })}
            </span>
          </div>
          <HeroCard
            label={t('overview.value')}
            value={totalsRow.valueCents}
            currency={totalsRow.currency}
            locale={locale}
          />
        </section>
      ))}

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-lg">{t('overview.assetsTitle')}</h2>
          <ManualAssetsSortBar sort={sort} />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {assets.map((asset) => {
            const Icon = TYPE_ICONS[asset.type]
            const gainLoss = asset.current_value_cents - asset.cost_basis_cents
            return (
              <Link
                key={asset.id}
                href={`/protected/manual-assets/${asset.id}`}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <GlassCard hoverable className="flex h-full flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <div className="flex flex-col">
                        <span className="font-semibold text-ink">
                          {asset.name}
                        </span>
                        <span className="text-ink-soft text-xs">
                          {t(`types.${asset.type}`)}
                        </span>
                      </div>
                    </div>
                    {asset.is_closed ? (
                      <Badge variant="neutral">{t('card.closed')}</Badge>
                    ) : null}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div className="flex flex-col">
                      <dt className="text-ink-soft text-xs">
                        {t('card.value')}
                      </dt>
                      <dd className="font-medium text-ink text-sm">
                        {fmt(asset.current_value_cents, asset.currency)}
                      </dd>
                    </div>
                    <div className="flex flex-col">
                      <dt className="text-ink-soft text-xs">
                        {t('card.gainLoss')}
                      </dt>
                      <dd
                        className={`font-medium text-sm ${
                          gainLoss >= 0 ? 'text-pos' : 'text-neg'
                        }`}
                      >
                        {fmt(gainLoss, asset.currency)}
                      </dd>
                    </div>
                  </dl>
                </GlassCard>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function sortAssets(
  assets: ManualAssetsOverview['assets'],
  sort: ManualAssetSort | null
): ManualAssetsOverview['assets'] {
  if (!sort) {
    return assets
  }
  const value = (a: ManualAssetsOverview['assets'][number]) => {
    switch (sort.field) {
      case 'name':
        return a.name
      case 'value':
        return a.current_value_cents
      case 'gainLoss':
        return a.current_value_cents - a.cost_basis_cents
    }
  }
  const sorted = [...assets].sort((a, b) => {
    const av = value(a)
    const bv = value(b)
    return typeof av === 'string' && typeof bv === 'string'
      ? av.localeCompare(bv)
      : (av as number) - (bv as number)
  })
  return sort.dir === 'asc' ? sorted : sorted.reverse()
}
