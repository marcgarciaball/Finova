'use client'

import { SortButton } from '@/components/ui/table/SortButton'
import { useClientSort } from '@/lib/hooks/useClientSort'
import type { ActionResult } from '../actions'
import { DeleteRowButton } from './DeleteRowButton'

export interface ExpenseRowView {
  amountCents: number
  amountLabel: string
  categoryLabel: string
  dateLabel: string
  description: string
  expenseDate: string
  id: string
}

export function ExpensesTable({
  rows,
  labels,
  deleteAction,
}: {
  rows: ExpenseRowView[]
  labels: {
    date: string
    category: string
    description: string
    amount: string
  }
  deleteAction: (id: string) => Promise<ActionResult>
}) {
  const { sort, sorted, toggleSort } = useClientSort<
    ExpenseRowView,
    'date' | 'category' | 'description' | 'amount'
  >(rows, {
    date: (a, b) => a.expenseDate.localeCompare(b.expenseDate),
    category: (a, b) => a.categoryLabel.localeCompare(b.categoryLabel),
    description: (a, b) => a.description.localeCompare(b.description),
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
          <th className="py-2 pr-4 font-medium">
            <SortButton
              label={labels.category}
              active={sort?.key === 'category'}
              direction={sort?.key === 'category' ? sort.dir : 'asc'}
              onClick={() => toggleSort('category')}
            />
          </th>
          <th className="py-2 pr-4 font-medium">
            <SortButton
              label={labels.description}
              active={sort?.key === 'description'}
              direction={sort?.key === 'description' ? sort.dir : 'asc'}
              onClick={() => toggleSort('description')}
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
        {sorted.map((expense) => (
          <tr key={expense.id} className="border-glass-line border-t">
            <td className="py-2 pr-4">{expense.dateLabel}</td>
            <td className="py-2 pr-4 text-ink-soft">{expense.categoryLabel}</td>
            <td className="py-2 pr-4">{expense.description}</td>
            <td className="py-2 pr-4 text-right text-neg">
              {expense.amountLabel}
            </td>
            <td className="py-2 text-right">
              <DeleteRowButton action={deleteAction} id={expense.id} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
