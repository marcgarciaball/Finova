import { DeltaPill } from '@/components/ui/delta-pill'
import { GlassCard } from '@/components/ui/glass-card'
import { Stat } from '@/components/ui/stat'
import { cn } from '@/lib/utils'

export interface KpiCardProps {
  className?: string
  delta?: number
  deltaSuffix?: string
  footnote?: string
  format?: (n: number) => string
  label: string
  value: number
}

export function KpiCard({
  label,
  value,
  format,
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
        <Stat value={value} format={format} />
        {delta !== undefined && (
          <DeltaPill value={delta} suffix={deltaSuffix} />
        )}
      </div>
      {footnote && <span className="text-ink-soft text-xs">{footnote}</span>}
    </GlassCard>
  )
}
