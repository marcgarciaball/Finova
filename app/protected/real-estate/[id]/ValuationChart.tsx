'use client'

import { useLocale } from 'next-intl'
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
import { format, money } from '@/lib/domain/money'

export interface ValuationPoint {
  date: string
  valueCents: number
}

/**
 * Property value over time — one brand-hue series (no legend; the section
 * title names it), compact currency ticks, money-formatted tooltip.
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
  const compact = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  })
  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: 'numeric',
  })
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
            <linearGradient id="valuation-fill" x1="0" y1="0" x2="0" y2="1">
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
              new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                new Date(`${d}T00:00:00Z`)
              )
            }
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={BRAND_LINE}
            strokeWidth={2}
            fill="url(#valuation-fill)"
            isAnimationActive={false}
          />
        </ReAreaChart>
      </ResponsiveContainer>
    </div>
  )
}
