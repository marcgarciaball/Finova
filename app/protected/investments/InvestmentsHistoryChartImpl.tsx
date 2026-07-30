'use client'

import { format, money } from '@finova/domain/money'
import { useLocale, useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import {
  Area,
  CartesianGrid,
  AreaChart as ReAreaChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { seriesColor } from '@/components/charts/chartTheme'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import type { HistoryPoint, TradeMarker } from './overview-data'

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

interface ChartRow {
  date: string
  trades?: TradeMarker[]
  [key: string]: number | string | TradeMarker[] | undefined
}

/**
 * Portfolio evolution: real daily value vs cumulative contributions, range
 * presets with the period's P/L in the header, buy/sell markers with trade
 * details in the tooltip, and compact currency ticks (€30K, €1.2M).
 */
export function InvestmentsHistoryChart({
  baseCurrency,
  history,
  trades,
}: {
  baseCurrency: string
  history: HistoryPoint[]
  trades: TradeMarker[]
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

  const buckets = new Map<string, ChartRow>()
  for (const point of visible) {
    const key = bucketKey(point.date, spanDays)
    const row: ChartRow = {
      date: key,
      [investedLabel]: Math.round(point.investedCents / 100),
    }
    if (point.valueCents !== null) {
      row[valueLabel] = Math.round(point.valueCents / 100)
    }
    buckets.set(key, row)
  }
  for (const trade of trades) {
    if (trade.date < start) {
      continue
    }
    const row = buckets.get(bucketKey(trade.date, spanDays))
    if (row) {
      row.trades = [...(row.trades ?? []), trade]
    }
  }
  const data = [...buckets.values()]
  const hasValue = valued.length > 0

  const compact = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        currency: baseCurrency,
        maximumFractionDigits: 1,
        notation: 'compact',
        style: 'currency',
      }),
    [locale, baseCurrency]
  )

  const investedColor = seriesColor(0)
  const valueColor = seriesColor(1)
  const categories = hasValue ? [investedLabel, valueLabel] : [investedLabel]

  const tradeLine = (trade: TradeMarker) =>
    `${trade.type === 'buy' ? t('form.buy') : t('form.sell')} ${trade.quantity} ${trade.ticker} @ ${format(money(trade.priceCents, trade.currency), locale)}`

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

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ReAreaChart
            data={data}
            margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
          >
            <defs>
              {categories.map((c, i) => (
                <linearGradient
                  key={c}
                  id={`inv-fill-${i}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={seriesColor(i)}
                    stopOpacity={0.22}
                  />
                  <stop
                    offset="100%"
                    stopColor={seriesColor(i)}
                    stopOpacity={0}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              stroke="var(--ink-soft)"
              strokeOpacity={0.12}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
              minTickGap={32}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={70}
              tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
              tickFormatter={(v: number) => compact.format(v)}
            />
            <Tooltip
              content={({ active, label, payload }) => {
                if (!active || !payload || payload.length === 0) {
                  return null
                }
                const row = payload[0]?.payload as ChartRow | undefined
                return (
                  <div
                    className="rounded-2xl border border-glass-line bg-glass px-3 py-2 text-sm shadow-soft backdrop-blur-xl"
                    style={{ color: 'var(--ink)' }}
                  >
                    <p className="font-medium">{String(label)}</p>
                    {payload.map((entry) => (
                      <p key={String(entry.dataKey)}>
                        <span style={{ color: entry.color }}>●</span>{' '}
                        {String(entry.dataKey)}:{' '}
                        {format(
                          money(
                            Math.round(Number(entry.value) * 100),
                            baseCurrency
                          ),
                          locale
                        )}
                      </p>
                    ))}
                    {row?.trades?.map((trade) => (
                      <p
                        key={`${trade.ticker}-${trade.date}-${trade.type}`}
                        className={
                          trade.type === 'buy' ? 'text-pos' : 'text-neg'
                        }
                      >
                        {tradeLine(trade)}
                      </p>
                    ))}
                  </div>
                )
              }}
            />
            {categories.map((c, i) => (
              <Area
                key={c}
                type="monotone"
                dataKey={c}
                stroke={seriesColor(i)}
                strokeWidth={2}
                fill={`url(#inv-fill-${i})`}
                isAnimationActive={false}
              />
            ))}
            {data.flatMap((row) => {
              if (!row.trades || row.trades.length === 0) {
                return []
              }
              const y =
                (row[valueLabel] as number | undefined) ??
                (row[investedLabel] as number | undefined)
              if (y === undefined) {
                return []
              }
              const anyBuy = row.trades.some((tr) => tr.type === 'buy')
              return [
                <ReferenceDot
                  key={`dot-${row.date}`}
                  x={row.date}
                  y={y}
                  r={4}
                  fill={anyBuy ? investedColor : valueColor}
                  stroke="var(--glass)"
                  strokeWidth={2}
                />,
              ]
            })}
          </ReAreaChart>
        </ResponsiveContainer>
      </div>
      {!hasValue ? (
        <p className="text-ink-soft text-xs">{t('overview.historyPending')}</p>
      ) : null}
    </div>
  )
}
