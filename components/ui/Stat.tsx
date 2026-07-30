'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface StatProps {
  className?: string
  currency?: string
  /** Renders `emptyDisplay` instead of the animated value (e.g. "no data yet"). */
  empty?: boolean
  emptyDisplay?: string
  locale?: string
  /** Appended to the plain-number format, e.g. "%" or "pp". Ignored when `currency` is set. */
  suffix?: string
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
  currency,
  locale,
  suffix = '',
  empty,
  emptyDisplay = '—',
  className,
}: StatProps) {
  const currencyFmt = React.useMemo(
    () =>
      currency && locale
        ? new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : null,
    [currency, locale]
  )
  const fmt = currencyFmt
    ? (n: number) => currencyFmt.format(n / 100)
    : (n: number) => `${n.toLocaleString()}${suffix}`
  const [display, setDisplay] = React.useState(value)

  React.useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value)
      return
    }
    // Reset to 0 before animating so the count-up always starts from zero.
    setDisplay(0)
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
        'whitespace-nowrap font-bold font-display text-4xl text-ink tabular-nums tracking-tight',
        className
      )}
    >
      {empty ? emptyDisplay : fmt(display)}
    </span>
  )
}
