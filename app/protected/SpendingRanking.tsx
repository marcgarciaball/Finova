import type { Trend } from '@finova/domain/dashboard'
import { format, money } from '@finova/domain/money'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { cn } from '@/lib/utils'

export interface RankRow {
  currency: string
  /** Leading marker — typically a `CategoryIcon` (absent for e.g. accounts). */
  icon?: ReactNode
  key: string
  label: string
  /** Fraction of the whole (0..1). */
  share: number
  /** Positive magnitude in cents. */
  total: number
  /** Direction vs. the previous period (optional; absent ⇒ no arrow). */
  trend?: Trend
}

/**
 * Generic ranked-spending panel (UD-05 top categories, UD-06 across accounts).
 * Rows arrive pre-sorted (the domain cores sort by total desc); each renders a
 * proportional bar so "where you spend most" reads at a glance. Presentation
 * only — labels/amounts resolved by the caller / formatted here per locale.
 */
export function SpendingRanking({
  title,
  rows,
  locale,
  emptyLabel,
  limit = 6,
  className,
}: {
  title: string
  rows: RankRow[]
  locale: string
  emptyLabel: string
  limit?: number
  className?: string
}) {
  const top = rows.slice(0, limit)
  const max = top.reduce((m, r) => Math.max(m, r.total), 0)

  return (
    <GlassCard className={cn('flex flex-col gap-4', className)}>
      <h2 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
        {title}
      </h2>
      {top.length === 0 ? (
        <p className="text-ink-soft text-sm">{emptyLabel}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {top.map((r) => (
            <li key={r.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-1.5 text-ink">
                  {r.icon}
                  {r.trend === 'up' && (
                    <ArrowUp
                      className="size-3.5 shrink-0 text-neg"
                      aria-label="trend-up"
                    />
                  )}
                  {r.trend === 'down' && (
                    <ArrowDown
                      className="size-3.5 shrink-0 text-pos"
                      aria-label="trend-down"
                    />
                  )}
                  <span className="truncate">{r.label}</span>
                </span>
                <span className="shrink-0 text-ink tabular-nums">
                  {format(money(r.total, r.currency), locale)}
                  <span className="ml-2 text-ink-soft text-xs">
                    {(r.share * 100).toLocaleString(locale, {
                      maximumFractionDigits: 1,
                    })}
                    %
                  </span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-glass-line">
                <div
                  className="h-full rounded-full bg-brand-600"
                  style={{ width: `${max === 0 ? 0 : (r.total / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </GlassCard>
  )
}
