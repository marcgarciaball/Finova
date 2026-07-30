'use client'

import { format, money } from '@finova/domain/money'
import { useLocale } from 'next-intl'
import { useMemo } from 'react'
import {
  Area,
  CartesianGrid,
  AreaChart as ReAreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BRAND_LINE } from '@/components/charts/chartTheme'

export interface ValuationPoint {
  date: string
  valueCents: number
}

/**
 * Asset value over time — one brand-hue series (no legend; the section title
 * names it), compact currency ticks, money-formatted tooltip. Mirrors the
 * Real Estate ValuationChart.
 */
export function ValuationChart({
  currency,
  points,
  title,
}: {
  currency: string
  points: ValuationPoint[]
  title: string
}) {
  const locale = useLocale()
  const compact = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 1,
      }),
    [locale, currency]
  )
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }),
    [locale]
  )
  const tooltipDateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }),
    [locale]
  )
  const data = points.map((p) => ({
    date: p.date,
    value: p.valueCents / 100,
  }))

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ReAreaChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="ma-valuation-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND_LINE} stopOpacity={0.28} />
              <stop offset="100%" stopColor={BRAND_LINE} stopOpacity={0} />
            </linearGradient>
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
            tickFormatter={(d: string) =>
              dateFmt.format(new Date(`${d}T00:00:00Z`))
            }
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            domain={['auto', 'auto']}
            tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
            tickFormatter={(v: number) => compact.format(v)}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 14,
              border: '1px solid var(--glass-line)',
              background: 'var(--glass)',
              backdropFilter: 'blur(22px)',
              color: 'var(--ink)',
            }}
            formatter={(v) => [
              format(money(Math.round(Number(v) * 100), currency), locale),
              title,
            ]}
            labelFormatter={(d) =>
              tooltipDateFmt.format(new Date(`${d}T00:00:00Z`))
            }
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={BRAND_LINE}
            strokeWidth={2}
            fill="url(#ma-valuation-fill)"
            isAnimationActive={false}
          />
        </ReAreaChart>
      </ResponsiveContainer>
    </div>
  )
}
