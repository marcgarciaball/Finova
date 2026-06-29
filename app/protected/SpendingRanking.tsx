import { GlassCard } from '@/components/ui/GlassCard'
import { format, money } from '@/lib/domain/money'

export interface RankRow {
  currency: string
  key: string
  label: string
  /** Fraction of the whole (0..1). */
  share: number
  /** Positive magnitude in cents. */
  total: number
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
}: {
  title: string
  rows: RankRow[]
  locale: string
  emptyLabel: string
  limit?: number
}) {
  const top = rows.slice(0, limit)
  const max = top.reduce((m, r) => Math.max(m, r.total), 0)

  return (
    <GlassCard className="flex flex-col gap-4">
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
                <span className="truncate text-ink">{r.label}</span>
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
