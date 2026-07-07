'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { AreaChart } from '@/components/charts/AreaChart'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { format, money } from '@/lib/domain/money'
import type { HistoryPoint } from './overview-data'

type Range = '1w' | '1m' | '3m' | 'ytd' | '1y' | 'all'
const RANGES: Range[] = ['1w', '1m', '3m', 'ytd', '1y', 'all']

function rangeStart(range: Range, todayIso: string): string {
  const d = new Date(`${todayIso}T00:00:00Z`)
  switch (range) {
    case '1w':
      d.setUTCDate(d.getUTCDate() - 7)
      break
    case '1m':
      d.setUTCMonth(d.getUTCMonth() - 1)
      break
    case '3m':
      d.setUTCMonth(d.getUTCMonth() - 3)
      break
    case 'ytd':
      return `${todayIso.slice(0, 4)}-01-01`
    case '1y':
      d.setUTCFullYear(d.getUTCFullYear() - 1)
      break
    case 'all':
      return '0000-00-00'
  }
  return d.toISOString().slice(0, 10)
}

/** Bucket size adapts to the visible span so long ranges stay readable. */
function bucketKey(date: string, spanDays: number): string {
  if (spanDays <= 100) {
    return date
  }
  if (spanDays <= 400) {
    const d = new Date(`${date}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
    return d.toISOString().slice(0, 10)
  }
  return date.slice(0, 7)
}

/**
 * Portfolio evolution: real daily value (historical closes × held quantity ×
 * that day's FX) vs cumulative contributions, with range presets and the
 * period's P/L in the header.
 */
export function InvestmentsHistoryChart({
  baseCurrency,
  history,
}: {
  baseCurrency: string
  history: HistoryPoint[]
}) {
  const t = useTranslations('investments')
  const locale = useLocale()
  const [range, setRange] = useState<Range>('all')

  const todayIso = history.at(-1)?.date ?? ''
  const start = rangeStart(range, todayIso)
  const visible = history.filter((h) => h.date >= start)
  const valued = visible.filter((h) => h.valueCents !== null)

  // Period P/L: change of the value line across the visible window.
  const first = valued[0]?.valueCents ?? null
  const last = valued.at(-1)?.valueCents ?? null
  const changeCents = first !== null && last !== null ? last - first : null
  const changePct =
    changeCents !== null && first !== null && first > 0
      ? (changeCents / first) * 100
      : null

  const spanDays =
    visible.length > 1
      ? (new Date(`${visible.at(-1)?.date}T00:00:00Z`).getTime() -
          new Date(`${visible[0]?.date}T00:00:00Z`).getTime()) /
        86_400_000
      : 0
  const investedLabel = t('overview.invested')
  const valueLabel = t('overview.value')
  const buckets = new Map<string, HistoryPoint>()
  for (const point of visible) {
    buckets.set(bucketKey(point.date, spanDays), point)
  }
  const hasValue = valued.length > 0
  const data = [...buckets.entries()].map(([bucket, point]) => {
    const row: Record<string, number | string> = {
      date: bucket,
      [investedLabel]: Math.round(point.investedCents / 100),
    }
    if (point.valueCents !== null) {
      row[valueLabel] = Math.round(point.valueCents / 100)
    }
    return row
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <p className="text-ink-soft text-sm">{t('overview.chart')}</p>
          {changeCents !== null ? (
            <p
              className={`font-medium text-sm ${changeCents >= 0 ? 'text-pos' : 'text-neg'}`}
            >
              {changeCents >= 0 ? '+' : ''}
              {format(money(changeCents, baseCurrency), locale)}
              {changePct !== null
                ? ` (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)`
                : ''}
            </p>
          ) : null}
        </div>
        <SegmentedControl
          aria-label={t('overview.range')}
          value={range}
          onValueChange={(v) => setRange(v as Range)}
          options={RANGES.map((r) => ({
            label: t(`overview.ranges.${r}`),
            value: r,
          }))}
        />
      </div>
      <AreaChart
        index="date"
        categories={hasValue ? [investedLabel, valueLabel] : [investedLabel]}
        data={data}
      />
      {!hasValue ? (
        <p className="text-ink-soft text-xs">{t('overview.historyPending')}</p>
      ) : null}
    </div>
  )
}
