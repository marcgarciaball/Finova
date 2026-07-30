'use client'

import dynamic from 'next/dynamic'

export type { DonutChartProps } from './DonutChartImpl'

/**
 * Wraps the recharts-based donut chart in a dynamic import so recharts
 * doesn't ship in the initial bundle for pages that render this component.
 */
export const DonutChart = dynamic(
  () => import('./DonutChartImpl').then((m) => m.DonutChart),
  { ssr: false, loading: () => <div className="h-60 w-full" /> }
)
