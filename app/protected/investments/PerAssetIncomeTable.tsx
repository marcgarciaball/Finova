'use client'

import { SortButton } from '@/components/ui/table/SortButton'
import { useClientSort } from '@/lib/hooks/useClientSort'

export interface PerAssetIncomeRow {
  forwardAnnualCents: number
  forwardAnnualDisplay: string
  name: string
  perShare12mDisplay: string
  receivedCents: number
  receivedDisplay: string
  ticker: string
  trailing12mPerShareCents: number
  yieldOnCostDisplay: string
  yieldOnCostPct: number | null
}

type SortKey =
  | 'asset'
  | 'received'
  | 'perShare12m'
  | 'forwardAnnual'
  | 'yieldOnCost'

export function PerAssetIncomeTable({
  rows,
  labels,
}: {
  rows: PerAssetIncomeRow[]
  labels: {
    asset: string
    received: string
    perShare12m: string
    forwardAnnual: string
    yieldOnCost: string
  }
}) {
  const { sort, sorted, toggleSort } = useClientSort<
    PerAssetIncomeRow,
    SortKey
  >(rows, {
    asset: (a, b) => a.ticker.localeCompare(b.ticker),
    forwardAnnual: (a, b) => a.forwardAnnualCents - b.forwardAnnualCents,
    perShare12m: (a, b) =>
      a.trailing12mPerShareCents - b.trailing12mPerShareCents,
    received: (a, b) => a.receivedCents - b.receivedCents,
    yieldOnCost: (a, b) =>
      (a.yieldOnCostPct ?? -Infinity) - (b.yieldOnCostPct ?? -Infinity),
  })

  const headerProps = (key: SortKey) => ({
    active: sort?.key === key,
    direction: (sort?.key === key ? sort.dir : 'asc') as 'asc' | 'desc',
    onClick: () => toggleSort(key),
  })

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-ink-soft">
          <th className="py-2 pr-4 font-medium">
            <SortButton label={labels.asset} {...headerProps('asset')} />
          </th>
          <th className="py-2 pr-4 text-right font-medium">
            <SortButton
              label={labels.received}
              align="right"
              {...headerProps('received')}
            />
          </th>
          <th className="py-2 pr-4 text-right font-medium">
            <SortButton
              label={labels.perShare12m}
              align="right"
              {...headerProps('perShare12m')}
            />
          </th>
          <th className="py-2 pr-4 text-right font-medium">
            <SortButton
              label={labels.forwardAnnual}
              align="right"
              {...headerProps('forwardAnnual')}
            />
          </th>
          <th className="py-2 text-right font-medium">
            <SortButton
              label={labels.yieldOnCost}
              align="right"
              {...headerProps('yieldOnCost')}
            />
          </th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((a) => (
          <tr key={a.ticker} className="border-glass-line border-t">
            <td className="py-2 pr-4">
              <span className="font-medium text-ink">{a.ticker}</span>
              <span className="text-ink-soft"> · {a.name}</span>
            </td>
            <td className="py-2 pr-4 text-right text-ink">
              {a.receivedDisplay}
            </td>
            <td className="py-2 pr-4 text-right text-ink">
              {a.perShare12mDisplay}
            </td>
            <td className="py-2 pr-4 text-right text-ink">
              {a.forwardAnnualDisplay}
            </td>
            <td className="py-2 text-right text-ink">{a.yieldOnCostDisplay}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
