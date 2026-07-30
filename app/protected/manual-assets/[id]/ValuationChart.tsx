'use client'

import dynamic from 'next/dynamic'

export type { ValuationPoint } from './ValuationChartImpl'

/**
 * Wraps the recharts-based valuation chart in a dynamic import so recharts
 * doesn't ship in the initial bundle for pages that render this component.
 */
export const ValuationChart = dynamic(
  () => import('./ValuationChartImpl').then((m) => m.ValuationChart),
  { ssr: false, loading: () => <div className="h-64 w-full" /> }
)
