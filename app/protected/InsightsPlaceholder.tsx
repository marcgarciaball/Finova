import { Sparkles } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { cn } from '@/lib/utils'

/**
 * Reserved home for Phase-3 insights (narrative, leak finder, forecast). Muted
 * preview rows so the layout already has a slot for them — not an empty gap.
 */
export function InsightsPlaceholder({
  title,
  soonLabel,
  items,
  className,
}: {
  title: string
  soonLabel: string
  items: string[]
  className?: string
}) {
  return (
    <GlassCard className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-medium text-ink-soft text-xs uppercase tracking-wide">
          <Sparkles className="size-4" aria-hidden="true" />
          {title}
        </h3>
        <span className="rounded-full bg-glass-line px-2 py-0.5 font-medium text-ink-soft text-xs">
          {soonLabel}
        </span>
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-center gap-3 rounded-2xl border border-glass-line border-dashed p-3 text-ink-soft text-sm"
          >
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-brand-300"
            />
            {item}
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}
