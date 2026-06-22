'use client'
import { cn } from '@/lib/utils'

export interface SegmentedOption {
  label: string
  value: string
}

export interface SegmentedControlProps {
  'aria-label': string
  className?: string
  onValueChange: (value: string) => void
  options: SegmentedOption[]
  value: string
}

export function SegmentedControl({
  options,
  value,
  onValueChange,
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('glass inline-flex gap-1 rounded-full p-1', className)}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          // biome-ignore lint/a11y/useSemanticElements: intentional accessible control pattern
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              'rounded-full px-4 py-1.5 font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 motion-safe:transition',
              active
                ? 'bg-glass text-ink shadow-soft'
                : 'text-ink-soft hover:text-ink'
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
