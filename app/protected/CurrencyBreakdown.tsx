import { format, money } from '@finova/domain/money'
import { GlassCard } from '@/components/ui/GlassCard'
import { cn } from '@/lib/utils'

/**
 * Net worth per currency (currency clarity). Each currency is its own line —
 * the domain never sums across currencies, so neither do we. The base currency
 * is tagged so a stray foreign balance (e.g. a USD coffee) never looks folded
 * into the EUR total.
 */
export function CurrencyBreakdown({
  netWorthByCurrency,
  baseCurrency,
  locale,
  title,
  baseLabel,
  className,
}: {
  netWorthByCurrency: Record<string, number>
  baseCurrency: string
  locale: string
  title: string
  baseLabel: string
  className?: string
}) {
  const rows = Object.entries(netWorthByCurrency).sort((a, b) => {
    if (a[0] === baseCurrency) return -1
    if (b[0] === baseCurrency) return 1
    return a[0].localeCompare(b[0])
  })

  return (
    <GlassCard className={cn('flex flex-col gap-4', className)}>
      <h3 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
        {title}
      </h3>
      <ul className="flex flex-col gap-3">
        {rows.map(([currency, total]) => (
          <li
            key={currency}
            className="flex items-baseline justify-between gap-3"
          >
            <span className="flex items-center gap-2 text-ink text-sm">
              {currency}
              {currency === baseCurrency && (
                <span className="rounded-full bg-brand-100 px-2 py-0.5 font-medium text-brand-700 text-xs">
                  {baseLabel}
                </span>
              )}
            </span>
            <span className="font-display font-semibold text-ink tabular-nums">
              {format(money(total, currency), locale)}
            </span>
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}
