'use client'

import { SortButton } from '@/components/ui/table/SortButton'
import { useClientSort } from '@/lib/hooks/useClientSort'
import type { ActionResult } from '../actions'
import { DeleteRowButton } from './DeleteRowButton'

export interface ValuationRowView {
  dateLabel: string
  id: string
  sourceLabel: string
  valuationDate: string
  valueCents: number
  valueLabel: string
}

export function ValuationsTable({
  rows,
  labels,
  deleteAction,
}: {
  rows: ValuationRowView[]
  labels: { date: string; value: string; source: string }
  deleteAction: (id: string) => Promise<ActionResult>
}) {
  const { sort, sorted, toggleSort } = useClientSort<
    ValuationRowView,
    'date' | 'value' | 'source'
  >(rows, {
    date: (a, b) => a.valuationDate.localeCompare(b.valuationDate),
    value: (a, b) => a.valueCents - b.valueCents,
    source: (a, b) => a.sourceLabel.localeCompare(b.sourceLabel),
  })

  return (
    <table className="mt-4 w-full text-sm">
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
              label={labels.value}
              active={sort?.key === 'value'}
              direction={sort?.key === 'value' ? sort.dir : 'asc'}
              onClick={() => toggleSort('value')}
              align="right"
            />
          </th>
          <th className="py-2 pr-4 font-medium">
            <SortButton
              label={labels.source}
              active={sort?.key === 'source'}
              direction={sort?.key === 'source' ? sort.dir : 'asc'}
              onClick={() => toggleSort('source')}
            />
          </th>
          <th className="py-2" />
        </tr>
      </thead>
      <tbody>
        {sorted.map((v) => (
          <tr key={v.id} className="border-glass-line border-t">
            <td className="py-2 pr-4">{v.dateLabel}</td>
            <td className="py-2 pr-4 text-right">{v.valueLabel}</td>
            <td className="py-2 pr-4 text-ink-soft">{v.sourceLabel}</td>
            <td className="py-2 text-right">
              <DeleteRowButton action={deleteAction} id={v.id} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
