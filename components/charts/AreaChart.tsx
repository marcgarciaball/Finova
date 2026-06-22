'use client'
import {
  Area,
  CartesianGrid,
  AreaChart as ReAreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BRAND_LINE, seriesColor } from '@/components/charts/chartTheme'
import { cn } from '@/lib/utils'

export interface AreaChartProps {
  categories: string[]
  className?: string
  data: Record<string, number | string>[]
  index: string
}

export function AreaChart({
  categories,
  className,
  data,
  index,
}: AreaChartProps) {
  const single = categories.length === 1
  return (
    <div className={cn('h-64 w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <ReAreaChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            {categories.map((c, i) => {
              const color = single ? BRAND_LINE : seriesColor(i)
              return (
                <linearGradient
                  key={c}
                  id={`fill-${c}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              )
            })}
          </defs>
          <CartesianGrid
            stroke="var(--ink-soft)"
            strokeOpacity={0.12}
            vertical={false}
          />
          <XAxis
            dataKey={index}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 14,
              border: '1px solid var(--glass-line)',
              background: 'var(--glass)',
              backdropFilter: 'blur(22px)',
              color: 'var(--ink)',
            }}
          />
          {categories.map((c, i) => {
            const color = single ? BRAND_LINE : seriesColor(i)
            return (
              <Area
                key={c}
                type="monotone"
                dataKey={c}
                stroke={color}
                strokeWidth={2}
                fill={`url(#fill-${c})`}
                isAnimationActive={false}
              />
            )
          })}
        </ReAreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export interface SparklineProps {
  className?: string
  data: number[]
}

export function Sparkline({ className, data }: SparklineProps) {
  const points = data.map((value, i) => ({ i, value }))
  return (
    <div className={cn('h-12 w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <ReAreaChart
          data={points}
          margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke="currentColor"
            strokeWidth={2}
            fill="url(#spark-fill)"
            isAnimationActive={false}
          />
        </ReAreaChart>
      </ResponsiveContainer>
    </div>
  )
}
