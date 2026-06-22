'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface StatProps {
  className?: string
  format?: (n: number) => string
  value: number
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

export function Stat({
  value,
  format = (n) => n.toLocaleString(),
  className,
}: StatProps) {
  const [display, setDisplay] = React.useState(value)

  React.useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value)
      return
    }
    let raf = 0
    const duration = 600
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setDisplay(value * (1 - (1 - t) ** 3))
      if (t < 1) raf = requestAnimationFrame(tick)
      else setDisplay(value)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return (
    <span
      className={cn(
        'font-bold font-display text-4xl text-ink tabular-nums tracking-tight',
        className
      )}
    >
      {format(display)}
    </span>
  )
}
