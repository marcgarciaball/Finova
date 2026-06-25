'use client'
import * as React from 'react'
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
  const buttonRefs = React.useRef<(HTMLButtonElement | null)[]>([])

  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    const count = options.length
    let nextIndex: number | null = null

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % count
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + count) % count
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = count - 1
        break
      default:
        return
    }

    e.preventDefault()
    const target = options[nextIndex]
    if (!target) return
    onValueChange(target.value)
    buttonRefs.current[nextIndex]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('glass inline-flex gap-1 rounded-full p-1', className)}
    >
      {options.map((opt, index) => {
        const active = opt.value === value
        return (
          // biome-ignore lint/a11y/useSemanticElements: intentional accessible control pattern
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            ref={(el) => {
              buttonRefs.current[index] = el
            }}
            onClick={() => onValueChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
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
