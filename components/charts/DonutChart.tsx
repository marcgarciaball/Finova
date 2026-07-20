'use client'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { seriesColor } from '@/components/charts/chartTheme'
import { cn } from '@/lib/utils'

export interface DonutChartProps {
  className?: string
  data: { name: string; value: number; color?: string }[]
}

export function DonutChart({ data, className }: DonutChartProps) {
  return (
    <div className={cn('h-60 w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={2}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={entry.color ?? seriesColor(i)} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 14,
              border: '1px solid var(--glass-line)',
              background: 'var(--glass)',
              backdropFilter: 'blur(22px)',
              color: 'var(--ink)',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
