'use client'

import { format, money } from '@finova/domain/money'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { type ReactNode, useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
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

/**
 * "How much do I earn?" — browsable by month (Día/Mes) or year (Año), via
 * the `?earningsView=`/`?earningsPeriod=` search params (same pattern as
 * `PeriodSelector`/`GranularitySelector` elsewhere on this page). In month
 * view, "Día" is that month's total ÷ days in that month; in year view the
 * total is the real annual sum the server computed — no client-side
 * multiplication.
 */
export function EarningsCard({
  rows,
  view,
  period,
  canGoPrev,
  canGoNext,
  isPartialYear,
  currency,
  className,
}: {
  rows: EarningsRow[]
  view: EarningsView
  /** `YYYY-MM` in month view, `YYYY` in year view. */
  period: string
  canGoPrev: boolean
  canGoNext: boolean
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
      router.push(`${pathname}?${params.toString()}`)
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

  const shift = (delta: number) => {
    if (view === 'year') {
      navigate('year', String(Number(period) + delta))
      return
    }
    const [y, m] = period.split('-').map(Number) as [number, number]
    const total = y * 12 + (m - 1) + delta
    const nextYear = Math.floor(total / 12)
    const nextMonth = ((total % 12) + 12) % 12
    navigate('month', `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`)
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
        <div className="flex items-center gap-1">
          <Button
            aria-label={
              view === 'month' ? t('nav.prevMonth') : t('nav.prevYear')
            }
            variant="ghost"
            size="icon"
            disabled={!canGoPrev}
            onClick={() => shift(-1)}
          >
            <ChevronLeft />
          </Button>
          <SegmentedControl
            aria-label={t('title')}
            value={unit}
            onValueChange={onUnitChange}
            options={UNITS.map((u) => ({ label: t(`units.${u}`), value: u }))}
          />
          <Button
            aria-label={
              view === 'month' ? t('nav.nextMonth') : t('nav.nextYear')
            }
            variant="ghost"
            size="icon"
            disabled={!canGoNext}
            onClick={() => shift(1)}
          >
            <ChevronRight />
          </Button>
        </div>
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
