import { format, money } from '@finova/domain/money'
import { getTranslations } from 'next-intl/server'
import { GlassCard } from '@/components/ui/GlassCard'
import { Stat } from '@/components/ui/Stat'
import { cn } from '@/lib/utils'

/**
 * Assets / debts / net-worth breakdown for the dashboard's display currency.
 * `totalDebtsCents` already includes mortgage debt (all debt types now live
 * in the `debts` table), so `totalAssetsCents` must use real estate's GROSS
 * value (equity + mortgage) to avoid double-counting — see the dashboard
 * page's computation for the exact derivation.
 */
export async function NetWorthCard({
  totalAssetsCents,
  totalDebtsCents,
  netWorthCents,
  currency,
  locale,
  debtToAssetRatioPct,
  className,
}: {
  totalAssetsCents: number
  totalDebtsCents: number
  netWorthCents: number
  currency: string
  locale: string
  debtToAssetRatioPct: number | null
  className?: string
}) {
  const t = await getTranslations('dashboard.netWorth')

  return (
    <GlassCard className={cn('flex flex-col gap-4', className)}>
      <h3 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
        {t('title')}
      </h3>
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-ink-soft text-sm">{t('totalAssets')}</span>
          <span className="font-display font-semibold text-ink tabular-nums">
            {format(money(totalAssetsCents, currency), locale)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-ink-soft text-sm">{t('totalDebts')}</span>
          <span className="font-display font-semibold text-neg tabular-nums">
            −{format(money(totalDebtsCents, currency), locale)}
          </span>
        </div>
        <div className="border-glass-line border-t pt-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium text-ink text-sm">
              {t('netWorth')}
            </span>
            <Stat
              value={netWorthCents}
              currency={currency}
              locale={locale}
              className="text-2xl"
            />
          </div>
        </div>
      </div>
      {debtToAssetRatioPct !== null ? (
        <p className="text-ink-soft text-xs">
          {t('debtToAssetRatio')}: {debtToAssetRatioPct.toFixed(1)}%
        </p>
      ) : null}
    </GlassCard>
  )
}
