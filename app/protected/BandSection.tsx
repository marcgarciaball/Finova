import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * One narrative band of the dashboard: a muted question heading over a shared
 * 12-column grid. Every band uses the same grid so cards line up and the page
 * reads as one composition instead of a stack of mismatched tiles.
 */
export function BandSection({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('flex flex-col gap-4', className)}>
      <h2 className="font-medium text-ink-soft text-sm tracking-wide">
        {title}
      </h2>
      <div className="grid grid-cols-12 gap-4 md:gap-5">{children}</div>
    </section>
  )
}
