'use client'

import { Badge } from '@/components/ui/Badge'
import { SortButton } from '@/components/ui/table/SortButton'
import { useClientSort } from '@/lib/hooks/useClientSort'
import type { RentalIncomeRow } from '@/lib/validation/real-estate'
import { IncomeRowActions } from './IncomeRowActions'

export interface IncomeRowView {
  amountCents: number
  amountLabel: string
  id: string
  income: RentalIncomeRow
  isPaid: boolean
  pendingLabel: string
  periodLabel: string
  periodStart: string
  tenantLabel: string
  tenantSortKey: string
}

export function IncomeTable({
  rows,
  labels,
}: {
  rows: IncomeRowView[]
  labels: { period: string; tenant: string; amount: string }
}) {
  const { sort, sorted, toggleSort } = useClientSort<
    IncomeRowView,
    'period' | 'tenant' | 'amount'
  >(rows, {
    period: (a, b) => a.periodStart.localeCompare(b.periodStart),
    tenant: (a, b) => a.tenantSortKey.localeCompare(b.tenantSortKey),
    amount: (a, b) => a.amountCents - b.amountCents,
  })

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-ink-soft">
          <th className="py-2 pr-4 font-medium">
            <SortButton
              label={labels.period}
              active={sort?.key === 'period'}
              direction={sort?.key === 'period' ? sort.dir : 'asc'}
              onClick={() => toggleSort('period')}
            />
          </th>
          <th className="py-2 pr-4 font-medium">
            <SortButton
              label={labels.tenant}
              active={sort?.key === 'tenant'}
              direction={sort?.key === 'tenant' ? sort.dir : 'asc'}
              onClick={() => toggleSort('tenant')}
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
        {sorted.map((income) => (
          <tr key={income.id} className="border-glass-line border-t">
            <td className="py-2 pr-4">
              {income.periodLabel}
              {income.isPaid ? null : (
                <Badge variant="neutral" className="ml-2">
                  {income.pendingLabel}
                </Badge>
              )}
            </td>
            <td className="py-2 pr-4 text-ink-soft">{income.tenantLabel}</td>
            <td className="py-2 pr-4 text-right text-pos">
              {income.amountLabel}
            </td>
            <td className="py-2 text-right">
              <IncomeRowActions income={income.income} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
