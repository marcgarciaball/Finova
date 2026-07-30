'use client'

import dynamic from 'next/dynamic'

export type { AreaChartProps, SparklineProps } from './AreaChartImpl'

/**
 * Wraps the recharts-based area chart / sparkline in a dynamic import so
 * recharts doesn't ship in the initial bundle for pages that render them.
 */
export const AreaChart = dynamic(
  () => import('./AreaChartImpl').then((m) => m.AreaChart),
  { ssr: false, loading: () => <div className="h-64 w-full" /> }
)

export const Sparkline = dynamic(
  () => import('./AreaChartImpl').then((m) => m.Sparkline),
  { ssr: false, loading: () => <div className="h-12 w-full" /> }
)
