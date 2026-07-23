import type { AssetType } from '@finova/domain/investments/types'
import { format, money } from '@finova/domain/money'
import { getLocale, getTranslations } from 'next-intl/server'
import { seriesColor } from '@/components/charts/chartTheme'
import { DonutChart } from '@/components/charts/DonutChart'
import { GlassCard } from '@/components/ui/GlassCard'
import { cn } from '@/lib/utils'

const ASSET_TYPE_ORDER: AssetType[] = ['stock', 'etf', 'fund', 'crypto']
const toMajor = (cents: number): number => cents / 100

/**
 * "Where is my money?" — cash vs. each investment asset type, all in one
 * currency so the shares actually add to 100%. Investment amounts only mix
 * in when the portfolio's base currency matches the dashboard's display
 * currency (cross-currency netting is a known limitation elsewhere too).
 */
export async function WealthAllocation({
  cashCents,
  investedByType,
  realEstateCents = 0,
  manualAssetsCents = 0,
  currency,
  className,
}: {
  cashCents: number
  investedByType: Partial<Record<AssetType, number>>
  realEstateCents?: number
  manualAssetsCents?: number
  currency: string
  className?: string
}) {
  const t = await getTranslations('dashboard.wealthAllocation')
  const tTypes = await getTranslations('investments.search.types')
  const locale = await getLocale()

  const rows = [
    { key: 'cash', label: t('cash'), cents: cashCents },
    ...ASSET_TYPE_ORDER.filter((type) => (investedByType[type] ?? 0) > 0).map(
      (type) => ({
        key: type,
        label: tTypes(type),
        cents: investedByType[type] ?? 0,
      })
    ),
    { key: 'realEstate', label: t('realEstate'), cents: realEstateCents },
    {
      key: 'manualAssets',
      label: t('manualAssets'),
      cents: manualAssetsCents,
    },
  ].filter((r) => r.cents > 0)

  const total = rows.reduce((sum, r) => sum + r.cents, 0)

  if (total === 0) {
    return null
  }

  const donutData = rows.map((r, i) => ({
    name: r.label,
    value: toMajor(r.cents),
    color: seriesColor(i),
  }))

  return (
    <GlassCard className={cn('flex flex-col gap-4', className)}>
      <h3 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
        {t('title')}
      </h3>
      <DonutChart data={donutData} className="h-40" />
      <ul className="flex flex-col gap-2.5">
        {rows.map((r, i) => (
          <li key={r.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-ink text-sm">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: seriesColor(i) }}
                />
                <span className="truncate">{r.label}</span>
              </span>
              <span className="shrink-0 text-ink text-sm tabular-nums">
                {format(money(r.cents, currency), locale)}
                <span className="ml-2 text-ink-soft text-xs">
                  {Math.round((r.cents / total) * 100)}%
                </span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-glass-line">
              <div
                className="h-full rounded-full"
                style={{
                  backgroundColor: seriesColor(i),
                  width: `${(r.cents / total) * 100}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}
