import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DeltaPillProps {
  className?: string
  suffix?: string
  value: number
}

export function DeltaPill({ value, suffix = '', className }: DeltaPillProps) {
  const positive = value >= 0
  const Icon = positive ? ArrowUp : ArrowDown
  const sign = positive ? '+' : '−'
  const magnitude = Math.abs(value)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs tabular-nums',
        positive ? 'bg-pos-soft text-pos' : 'bg-neg-soft text-neg',
        className
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {`${sign}${magnitude}${suffix}`}
    </span>
  )
}
