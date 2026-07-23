'use client'

import type { AssetType } from '@finova/domain/investments/types'
import { SortButton } from '@/components/ui/table/SortButton'
import { useClientSort } from '@/lib/hooks/useClientSort'
import { TransactionRowActions } from './TransactionRowActions'

export interface TransactionRow {
  assetId: string
  assetType: AssetType
  currency: string
  fees: string
  feesCents: number
  feesDisplay: string
  id: string
  name: string
  notes: string
  price: string
  priceCents: number
  priceDisplay: string
  quantity: number
  ticker: string
  tradedAt: string
  type: string
  typeLabel: string
}

type SortKey = 'date' | 'asset' | 'type' | 'quantity' | 'price' | 'fees'

export function TransactionsTable({
  rows,
  labels,
  todayIso,
}: {
  rows: TransactionRow[]
  labels: {
    date: string
    asset: string
    type: string
    quantity: string
    price: string
    fees: string
  }
  todayIso: string
}) {
  const { sort, sorted, toggleSort } = useClientSort<TransactionRow, SortKey>(
    rows,
    {
      asset: (a, b) => (a.ticker || a.name).localeCompare(b.ticker || b.name),
      date: (a, b) => a.tradedAt.localeCompare(b.tradedAt),
      fees: (a, b) => a.feesCents - b.feesCents,
      price: (a, b) => a.priceCents - b.priceCents,
      quantity: (a, b) => a.quantity - b.quantity,
      type: (a, b) => a.type.localeCompare(b.type),
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
            <SortButton label={labels.date} {...headerProps('date')} />
          </th>
          <th className="py-2 pr-4 font-medium">
            <SortButton label={labels.asset} {...headerProps('asset')} />
          </th>
          <th className="py-2 pr-4 font-medium">
            <SortButton label={labels.type} {...headerProps('type')} />
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
              label={labels.price}
              align="right"
              {...headerProps('price')}
            />
          </th>
          <th className="py-2 text-right font-medium">
            <SortButton
              label={labels.fees}
              align="right"
              {...headerProps('fees')}
            />
          </th>
          <th className="py-2" />
        </tr>
      </thead>
      <tbody>
        {sorted.map((txn) => (
          <tr key={txn.id} className="border-glass-line border-t">
            <td className="py-2 pr-4 text-ink-soft">{txn.tradedAt}</td>
            <td className="py-2 pr-4 text-ink">
              <span className="font-medium">{txn.ticker || txn.name}</span>
              {txn.ticker ? (
                <span className="text-ink-soft"> · {txn.name}</span>
              ) : null}
            </td>
            <td className="py-2 pr-4">
              <span className={txn.type === 'buy' ? 'text-pos' : 'text-neg'}>
                {txn.typeLabel}
              </span>
            </td>
            <td className="py-2 pr-4 text-right text-ink">{txn.quantity}</td>
            <td className="py-2 pr-4 text-right text-ink">
              {txn.priceDisplay}
            </td>
            <td className="py-2 text-right text-ink-soft">{txn.feesDisplay}</td>
            <td className="py-2 pl-2">
              <TransactionRowActions
                asset={{
                  currency: txn.currency,
                  id: txn.assetId,
                  name: txn.name,
                  ticker: txn.ticker,
                  type: txn.assetType,
                }}
                todayIso={todayIso}
                txn={{
                  currency: txn.currency,
                  fees: txn.fees,
                  id: txn.id,
                  notes: txn.notes,
                  price: txn.price,
                  quantity: String(txn.quantity),
                  tradedAt: txn.tradedAt,
                  type: txn.type as 'buy' | 'sell',
                }}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
