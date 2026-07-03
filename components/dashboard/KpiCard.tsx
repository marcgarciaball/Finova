import { DeltaPill } from '@/components/ui/DeltaPill'
import { GlassCard } from '@/components/ui/GlassCard'
import { Stat } from '@/components/ui/Stat'
import { cn } from '@/lib/utils'

export interface KpiCardProps {
  className?: string
  currency?: string
  delta?: number
  deltaSuffix?: string
  empty?: boolean
  emptyDisplay?: string
  footnote?: string
  label: string
  locale?: string
  suffix?: string
  value: number
}

export function KpiCard({
  label,
  value,
  suffix,
  empty,
  emptyDisplay,
  currency,
  locale,
  delta,
  deltaSuffix,
  footnote,
  className,
}: KpiCardProps) {
  return (
    <GlassCard
      hoverable
      className={cn('flex min-w-0 flex-col gap-2', className)}
    >
      <span className="font-medium text-ink-soft text-xs uppercase tracking-wide">
        {label}
      </span>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <Stat
          className="text-2xl sm:text-3xl"
          value={value}
          suffix={suffix}
          empty={empty}
          emptyDisplay={emptyDisplay}
          currency={currency}
          locale={locale}
        />
        {delta !== undefined && (
          <DeltaPill value={delta} suffix={deltaSuffix} />
        )}
      </div>
      {footnote && <span className="text-ink-soft text-xs">{footnote}</span>}
    </GlassCard>
  )
}
