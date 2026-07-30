'use client'

import dynamic from 'next/dynamic'

export type { BarChartProps } from './BarChartImpl'

/**
 * Wraps the recharts-based bar chart in a dynamic import so recharts
 * doesn't ship in the initial bundle for pages that render this component.
 */
export const BarChart = dynamic(
  () => import('./BarChartImpl').then((m) => m.BarChart),
  { ssr: false, loading: () => <div className="h-64 w-full" /> }
)
