'use client'

import { useLocale, useTranslations } from 'next-intl'
import { type ReactNode, useState } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { format, money } from '@/lib/domain/money'
import { cn } from '@/lib/utils'

export interface EarningsRow {
  /** Amount earned in the reference month, integer cents. */
  cents: number
  icon?: ReactNode
  key: string
  label: string
}

type Unit = 'day' | 'month' | 'year'
const UNITS: Unit[] = ['day', 'month', 'year']

/**
 * "How much do I earn?" — one card, one mental model. Takes the reference
 * month's income per source (e.g. salary in June) and converts it with plain
 * arithmetic: per day = month ÷ days in month, per year = month × 12. The
 * footnote names the month so the figures are traceable to real data.
 */
export function EarningsCard({
  rows,
  monthIso,
  daysInMonth,
  currency,
  className,
}: {
  rows: EarningsRow[]
  /** `YYYY-MM` of the reference month. */
  monthIso: string
  daysInMonth: number
  currency: string
  className?: string
}) {
  const t = useTranslations('dashboard.earnings')
  const locale = useLocale()
  const [unit, setUnit] = useState<Unit>('month')

  const convert = (cents: number): number =>
    unit === 'day'
      ? Math.round(cents / daysInMonth)
      : unit === 'year'
        ? cents * 12
        : cents

  const totalCents = rows.reduce((sum, r) => sum + r.cents, 0)
  const monthLabel = new Date(`${monthIso}-01T00:00:00Z`).toLocaleDateString(
    locale,
    { month: 'long', year: 'numeric', timeZone: 'UTC' }
  )

  return (
    <GlassCard className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
          {t('title')}
        </h3>
        <SegmentedControl
          aria-label={t('title')}
          value={unit}
          onValueChange={(v) => setUnit(v as Unit)}
          options={UNITS.map((u) => ({ label: t(`units.${u}`), value: u }))}
        />
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
        {t('basedOn', { month: monthLabel })}
      </p>
    </GlassCard>
  )
}
