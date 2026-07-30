'use client'

import dynamic from 'next/dynamic'

export type { HistoryPoint, TradeMarker } from './overview-data'

/**
 * Wraps the recharts-based history chart in a dynamic import so recharts
 * doesn't ship in the initial bundle for pages that render this component.
 */
export const InvestmentsHistoryChart = dynamic(
  () =>
    import('./InvestmentsHistoryChartImpl').then(
      (m) => m.InvestmentsHistoryChart
    ),
  { ssr: false, loading: () => <div className="h-72 w-full" /> }
)
