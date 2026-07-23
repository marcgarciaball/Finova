'use client'

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SortDirection = 'asc' | 'desc'

/**
 * Clickable column label + direction arrow, for both real `<th>` headers and
 * standalone "sort by" toolbars above card layouts. Toggles asc/desc on the
 * active column; a click on a different column starts it ascending.
 */
export function SortButton({
  label,
  active,
  direction,
  onClick,
  align = 'left',
  className,
}: {
  label: string
  active: boolean
  direction: SortDirection
  onClick: () => void
  align?: 'left' | 'right'
  className?: string
}) {
  const Icon = active
    ? direction === 'asc'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded text-ink-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        align === 'right' && 'flex-row-reverse',
        active && 'text-ink',
        className
      )}
    >
      {label}
      <Icon
        className={cn('size-3.5', !active && 'opacity-40')}
        aria-hidden="true"
      />
    </button>
  )
}
