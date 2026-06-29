import { ArrowDown, ArrowUp } from 'lucide-react'
import { Sparkline } from '@/components/charts/AreaChart'
import { Stat } from '@/components/ui/Stat'
import { cn } from '@/lib/utils'

export interface HeroCardProps {
  className?: string
  currency?: string
  delta?: number
  deltaSuffix?: string
  format?: (n: number) => string
  label: string
  locale?: string
  trend?: number[]
  value: number
}

export function HeroCard({
  label,
  value,
  format,
  currency,
  locale,
  delta,
  deltaSuffix = '',
  trend,
  className,
}: HeroCardProps) {
  const positive = (delta ?? 0) >= 0
  const Icon = positive ? ArrowUp : ArrowDown
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 to-brand-700 p-6 text-white shadow-glass',
        className
      )}
    >
      <div
        aria-hidden="true"
        className="-right-10 -top-10 pointer-events-none absolute size-48 rounded-full opacity-40 blur-2xl"
        style={{
          background:
            'radial-gradient(circle, var(--cat-teal), transparent 70%)',
        }}
      />
      <div className="relative flex flex-col gap-3">
        <span className="font-medium text-sm text-white/70 uppercase tracking-wide">
          {label}
        </span>
        <Stat
          value={value}
          format={format}
          currency={currency}
          locale={locale}
          className="text-white"
        />
        {delta !== undefined && (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 font-medium text-sm tabular-nums">
            <Icon className="size-3.5" aria-hidden="true" />
            {`${positive ? '+' : '−'}${Math.abs(delta)}${deltaSuffix}`}
          </span>
        )}
        {trend && trend.length > 0 && (
          <div className="mt-2 text-white/80">
            <Sparkline data={trend} />
          </div>
        )}
      </div>
    </div>
  )
}
