'use client'
import {
  Bar,
  CartesianGrid,
  BarChart as ReBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import { seriesColor } from './chart-theme'

export interface BarChartProps {
  categories: string[]
  className?: string
  data: Record<string, number | string>[]
  index: string
}

export function BarChart({
  categories,
  className,
  data,
  index,
}: BarChartProps) {
  return (
    <div className={cn('h-64 w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
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
            cursor={{ fill: 'var(--brand-100)', opacity: 0.4 }}
            contentStyle={{
              borderRadius: 14,
              border: '1px solid var(--glass-line)',
              background: 'var(--glass)',
              backdropFilter: 'blur(22px)',
              color: 'var(--ink)',
            }}
          />
          {categories.map((c, i) => (
            <Bar
              key={c}
              dataKey={c}
              fill={seriesColor(i)}
              radius={[6, 6, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  )
}
