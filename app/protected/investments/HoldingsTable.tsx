'use client'

import { SortButton } from '@/components/ui/table/SortButton'
import { useClientSort } from '@/lib/hooks/useClientSort'

export interface HoldingRow {
  assetId: string
  avgCostCents: number
  avgCostDisplay: string
  currentPriceCents: number | null
  currentValueCents: number | null
  name: string
  plDisplay: string | null
  priceDisplay: string | null
  quantity: number
  stale: boolean
  staleLabel: string
  ticker: string
  unpricedLabel: string
  unrealizedPlCents: number | null
  valueDisplay: string | null
}

type SortKey = 'asset' | 'quantity' | 'avgCost' | 'price' | 'value' | 'pl'

export function HoldingsTable({
  rows,
  labels,
  plClassName,
}: {
  rows: HoldingRow[]
  labels: {
    asset: string
    quantity: string
    avgCost: string
    price: string
    value: string
    pl: string
  }
  plClassName: (cents: number | null) => string
}) {
  const { sort, sorted, toggleSort } = useClientSort<HoldingRow, SortKey>(
    rows,
    {
      asset: (a, b) => (a.ticker || a.name).localeCompare(b.ticker || b.name),
      quantity: (a, b) => a.quantity - b.quantity,
      avgCost: (a, b) => a.avgCostCents - b.avgCostCents,
      price: (a, b) =>
        (a.currentPriceCents ?? -Infinity) - (b.currentPriceCents ?? -Infinity),
      value: (a, b) =>
        (a.currentValueCents ?? -Infinity) - (b.currentValueCents ?? -Infinity),
      pl: (a, b) =>
        (a.unrealizedPlCents ?? -Infinity) - (b.unrealizedPlCents ?? -Infinity),
    }
  )

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
              label={labels.quantity}
              align="right"
              {...headerProps('quantity')}
            />
          </th>
          <th className="py-2 pr-4 text-right font-medium">
            <SortButton
              label={labels.avgCost}
              align="right"
              {...headerProps('avgCost')}
            />
          </th>
          <th className="py-2 pr-4 text-right font-medium">
            <SortButton
              label={labels.price}
              align="right"
              {...headerProps('price')}
            />
          </th>
          <th className="py-2 pr-4 text-right font-medium">
            <SortButton
              label={labels.value}
              align="right"
              {...headerProps('value')}
            />
          </th>
          <th className="py-2 text-right font-medium">
            <SortButton
              label={labels.pl}
              align="right"
              {...headerProps('pl')}
            />
          </th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((h) => (
          <tr key={h.assetId} className="border-glass-line border-t">
            <td className="py-2 pr-4">
              <span className="font-medium text-ink">{h.ticker || h.name}</span>
              {h.ticker ? (
                <span className="text-ink-soft"> · {h.name}</span>
              ) : null}
            </td>
            <td className="py-2 pr-4 text-right text-ink">{h.quantity}</td>
            <td className="py-2 pr-4 text-right text-ink">
              {h.avgCostDisplay}
            </td>
            <td className="py-2 pr-4 text-right text-ink">
              {h.currentPriceCents === null ? (
                <span className="text-ink-soft">{h.unpricedLabel}</span>
              ) : (
                <>
                  {h.priceDisplay}
                  {h.stale ? (
                    <span className="text-warn" title={h.staleLabel}>
                      {' '}
                      •
                    </span>
                  ) : null}
                </>
              )}
            </td>
            <td className="py-2 pr-4 text-right text-ink">
              {h.currentValueCents === null ? '—' : h.valueDisplay}
            </td>
            <td
              className={`py-2 text-right ${plClassName(h.unrealizedPlCents)}`}
            >
              {h.unrealizedPlCents === null ? '—' : h.plDisplay}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
