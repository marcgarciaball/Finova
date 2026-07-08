import { getLocale, getTranslations } from 'next-intl/server'
import { seriesColor } from '@/components/charts/chartTheme'
import { DonutChart } from '@/components/charts/DonutChart'
import { GlassCard } from '@/components/ui/GlassCard'
import type { AssetType } from '@/lib/domain/investments/types'
import { format, money } from '@/lib/domain/money'
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
  currency,
  className,
}: {
  cashCents: number
  investedByType: Partial<Record<AssetType, number>>
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
      <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
        <DonutChart data={donutData} />
        <ul className="flex flex-col gap-3">
          {rows.map((r, i) => (
            <li
              key={r.key}
              className="flex items-baseline justify-between gap-3"
            >
              <span className="flex items-center gap-2 text-ink text-sm">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: seriesColor(i) }}
                />
                {r.label}
              </span>
              <span className="flex items-baseline gap-2">
                <span className="font-display font-semibold text-ink tabular-nums">
                  {format(money(r.cents, currency), locale)}
                </span>
                <span className="text-ink-soft text-xs tabular-nums">
                  {Math.round((r.cents / total) * 100)}%
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </GlassCard>
  )
}
