'use client'

import { SortButton } from '@/components/ui/table/SortButton'
import { useClientSort } from '@/lib/hooks/useClientSort'
import type { ActionResult } from '../actions'
import { DeleteRowButton } from './DeleteRowButton'

export interface IncomeRowView {
  amountCents: number
  amountLabel: string
  dateLabel: string
  id: string
  receivedDate: string
}

export function IncomeTable({
  rows,
  labels,
  deleteAction,
}: {
  rows: IncomeRowView[]
  labels: { date: string; amount: string }
  deleteAction: (id: string) => Promise<ActionResult>
}) {
  const { sort, sorted, toggleSort } = useClientSort<
    IncomeRowView,
    'date' | 'amount'
  >(rows, {
    date: (a, b) => a.receivedDate.localeCompare(b.receivedDate),
    amount: (a, b) => a.amountCents - b.amountCents,
  })

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-ink-soft">
          <th className="py-2 pr-4 font-medium">
            <SortButton
              label={labels.date}
              active={sort?.key === 'date'}
              direction={sort?.key === 'date' ? sort.dir : 'asc'}
              onClick={() => toggleSort('date')}
            />
          </th>
          <th className="py-2 pr-4 text-right font-medium">
            <SortButton
              label={labels.amount}
              active={sort?.key === 'amount'}
              direction={sort?.key === 'amount' ? sort.dir : 'asc'}
              onClick={() => toggleSort('amount')}
              align="right"
            />
          </th>
          <th className="py-2" />
        </tr>
      </thead>
      <tbody>
        {sorted.map((i) => (
          <tr key={i.id} className="border-glass-line border-t">
            <td className="py-2 pr-4">{i.dateLabel}</td>
            <td className="py-2 pr-4 text-right">{i.amountLabel}</td>
            <td className="py-2 text-right">
              <DeleteRowButton action={deleteAction} id={i.id} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
