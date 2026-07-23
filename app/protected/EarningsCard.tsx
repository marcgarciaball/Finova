'use client'

import { format, money } from '@finova/domain/money'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { type ReactNode, useState, useTransition } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { cn } from '@/lib/utils'

export interface EarningsRow {
  /** Amount earned in the selected period, integer cents. */
  cents: number
  icon?: ReactNode
  key: string
  label: string
}

export type EarningsView = 'month' | 'year'
type Unit = 'day' | 'month' | 'year'
const UNITS: Unit[] = ['day', 'month', 'year']
const SELECT_CLASS =
  'h-9 rounded-xl border border-glass-line bg-glass px-2 text-ink text-xs shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

/**
 * "How much do I earn?" — browsable by month (Día/Mes) or year (Año), via
 * the `?earningsView=`/`?earningsPeriod=` search params (same pattern as
 * `PeriodSelector`/`GranularitySelector` elsewhere on this page). Month/year
 * pickers (not prev/next buttons) let you jump straight to a period instead
 * of stepping through one at a time, and navigation is `scroll: false` so
 * picking a period doesn't jerk the page back to the top. In month view,
 * "Día" is that month's total ÷ days in that month; in year view the total
 * is the real annual sum the server computed — no client-side multiplication.
 */
export function EarningsCard({
  rows,
  view,
  period,
  earliestPeriod,
  latestPeriod,
  isPartialYear,
  currency,
  className,
}: {
  rows: EarningsRow[]
  view: EarningsView
  /** `YYYY-MM` in month view, `YYYY` in year view. */
  period: string
  /** Earliest browsable period with any activity, same shape as `period`. */
  earliestPeriod: string
  /** Latest (current) browsable period, same shape as `period`. */
  latestPeriod: string
  isPartialYear: boolean
  currency: string
  className?: string
}) {
  const t = useTranslations('dashboard.earnings')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [monthUnit, setMonthUnit] = useState<'day' | 'month'>('month')

  const unit: Unit = view === 'year' ? 'year' : monthUnit

  const navigate = (nextView: EarningsView, nextPeriod?: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('earningsView', nextView)
    if (nextPeriod) {
      params.set('earningsPeriod', nextPeriod)
    } else {
      params.delete('earningsPeriod')
    }
    startTransition(() => {
      // Picking a period shouldn't jerk the page back to the top.
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  const onUnitChange = (next: string) => {
    if (next === 'year') {
      if (view !== 'year') {
        navigate('year')
      }
      return
    }
    setMonthUnit(next as 'day' | 'month')
    if (view !== 'month') {
      navigate('month')
    }
  }

  const periodYear = view === 'month' ? period.slice(0, 4) : period
  const periodMonth = view === 'month' ? period.slice(5, 7) : null

  const yearOptions: string[] = []
  for (
    let y = Number(earliestPeriod.slice(0, 4));
    y <= Number(latestPeriod.slice(0, 4));
    y += 1
  ) {
    yearOptions.push(String(y))
  }

  const monthFormatter = new Intl.DateTimeFormat(locale, {
    month: 'long',
    timeZone: 'UTC',
  })
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1).padStart(2, '0'),
    label: monthFormatter.format(new Date(Date.UTC(2000, i, 1))),
  }))

  const onMonthSelect = (nextMonth: string) => {
    navigate('month', `${periodYear}-${nextMonth}`)
  }
  const onYearSelect = (nextYear: string) => {
    navigate(view, view === 'month' ? `${nextYear}-${periodMonth}` : nextYear)
  }

  const daysInMonth =
    view === 'month'
      ? (() => {
          const [y, m] = period.split('-').map(Number) as [number, number]
          return new Date(Date.UTC(y, m, 0)).getUTCDate()
        })()
      : 30

  const convert = (cents: number): number =>
    view === 'month' && unit === 'day' ? Math.round(cents / daysInMonth) : cents

  const totalCents = rows.reduce((sum, r) => sum + r.cents, 0)
  const periodLabel =
    view === 'month'
      ? new Date(`${period}-01T00:00:00Z`).toLocaleDateString(locale, {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : period

  return (
    <GlassCard className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
          {t('title')}
        </h3>
        <SegmentedControl
          aria-label={t('title')}
          value={unit}
          onValueChange={onUnitChange}
          options={UNITS.map((u) => ({ label: t(`units.${u}`), value: u }))}
        />
      </div>

      <div className="flex items-center justify-center gap-2">
        {view === 'month' ? (
          <select
            aria-label={t('nav.selectMonth')}
            className={SELECT_CLASS}
            value={periodMonth ?? ''}
            onChange={(e) => onMonthSelect(e.target.value)}
          >
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        ) : null}
        <select
          aria-label={t('nav.selectYear')}
          className={SELECT_CLASS}
          value={periodYear}
          onChange={(e) => onYearSelect(e.target.value)}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-display font-semibold text-3xl text-ink tabular-nums">
          {format(money(convert(totalCents), currency), locale)}
        </span>
        <span className="text-ink-soft text-sm">{t(`per.${unit}`)}</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-ink-soft text-sm">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-ink text-sm">
                {r.icon}
                <span className="truncate">{r.label}</span>
              </span>
              <span className="shrink-0 font-medium text-ink text-sm tabular-nums">
                {format(money(convert(r.cents), currency), locale)}
                <span className="ml-2 text-ink-soft text-xs">
                  {totalCents > 0
                    ? `${Math.round((r.cents / totalCents) * 100)}%`
                    : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-ink-soft text-xs">
        {view === 'month'
          ? t('basedOn', { month: periodLabel })
          : isPartialYear
            ? t('basedOnYearSoFar', { year: period })
            : t('basedOnYear', { year: period })}
      </p>
    </GlassCard>
  )
}
