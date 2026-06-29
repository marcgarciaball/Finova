import { DeltaPill } from '@/components/ui/DeltaPill'
import { GlassCard } from '@/components/ui/GlassCard'
import { Stat } from '@/components/ui/Stat'
import { cn } from '@/lib/utils'

export interface KpiCardProps {
  className?: string
  currency?: string
  delta?: number
  deltaSuffix?: string
  footnote?: string
  format?: (n: number) => string
  label: string
  locale?: string
  value: number
}

export function KpiCard({
  label,
  value,
  format,
  currency,
  locale,
  delta,
  deltaSuffix,
  footnote,
  className,
}: KpiCardProps) {
  return (
    <GlassCard hoverable className={cn('flex flex-col gap-2', className)}>
      <span className="font-medium text-ink-soft text-xs uppercase tracking-wide">
        {label}
      </span>
      <div className="flex items-end justify-between gap-3">
        <Stat
          value={value}
          format={format}
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
