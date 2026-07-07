'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { AreaChart } from '@/components/charts/AreaChart'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import type { HistoryPoint } from './overview-data'

type Granularity = 'day' | 'week' | 'month' | 'year'

/** Bucket key per granularity; points collapse to the last one per bucket. */
function bucketKey(date: string, g: Granularity): string {
  if (g === 'day') {
    return date
  }
  if (g === 'week') {
    const d = new Date(`${date}T00:00:00Z`)
    const day = (d.getUTCDay() + 6) % 7 // Monday-start week
    d.setUTCDate(d.getUTCDate() - day)
    return d.toISOString().slice(0, 10)
  }
  return g === 'month' ? date.slice(0, 7) : date.slice(0, 4)
}

/** Invested-vs-value evolution with a day/week/month/year switch. */
export function InvestmentsHistoryChart({
  history,
}: {
  history: HistoryPoint[]
}) {
  const t = useTranslations('investments')
  const [granularity, setGranularity] = useState<Granularity>('month')

  const investedLabel = t('overview.invested')
  const valueLabel = t('overview.value')

  // history is date-sorted; the last point in each bucket wins.
  const buckets = new Map<string, HistoryPoint>()
  for (const point of history) {
    buckets.set(bucketKey(point.date, granularity), point)
  }
  const hasValue = history.some((h) => h.valueCents !== null)
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
        <p className="text-ink-soft text-sm">{t('overview.chart')}</p>
        <SegmentedControl
          aria-label={t('overview.granularity')}
          value={granularity}
          onValueChange={(v) => setGranularity(v as Granularity)}
          options={(['day', 'week', 'month', 'year'] as const).map((g) => ({
            label: t(`overview.granularities.${g}`),
            value: g,
          }))}
        />
      </div>
      <AreaChart
        index="date"
        categories={hasValue ? [investedLabel, valueLabel] : [investedLabel]}
        data={data}
      />
    </div>
  )
}
