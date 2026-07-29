'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { SortButton } from '@/components/ui/table/SortButton'
import { useClientSort } from '@/lib/hooks/useClientSort'
import type { DebtRow } from '@/lib/validation/debts'
import { DebtRowActions } from './DebtRowActions'

export interface DebtRowView {
  debt: DebtRow
  lenderName: string
  outstandingCents: number
  outstandingLabel: string
  paymentCents: number
  paymentLabel: string
  rateLabel: string
  ratePct: number
  statusLabel: string
  statusVariant: 'pos' | 'neutral' | 'neg'
  typeLabel: string
}

export function DebtsTable({
  rows,
  labels,
}: {
  rows: DebtRowView[]
  labels: {
    lender: string
    type: string
    outstanding: string
    rate: string
    payment: string
    status: string
  }
}) {
  const { sort, sorted, toggleSort } = useClientSort<
    DebtRowView,
    'lender' | 'type' | 'outstanding' | 'rate' | 'payment'
  >(rows, {
    lender: (a, b) => a.lenderName.localeCompare(b.lenderName),
    type: (a, b) => a.typeLabel.localeCompare(b.typeLabel),
    outstanding: (a, b) => a.outstandingCents - b.outstandingCents,
    rate: (a, b) => a.ratePct - b.ratePct,
    payment: (a, b) => a.paymentCents - b.paymentCents,
  })

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-ink-soft">
          <th className="py-2 pr-4 font-medium">
            <SortButton
              label={labels.lender}
              active={sort?.key === 'lender'}
              direction={sort?.key === 'lender' ? sort.dir : 'asc'}
              onClick={() => toggleSort('lender')}
            />
          </th>
          <th className="py-2 pr-4 font-medium">
            <SortButton
              label={labels.type}
              active={sort?.key === 'type'}
              direction={sort?.key === 'type' ? sort.dir : 'asc'}
              onClick={() => toggleSort('type')}
            />
          </th>
          <th className="py-2 pr-4 text-right font-medium">
            <SortButton
              label={labels.outstanding}
              active={sort?.key === 'outstanding'}
              direction={sort?.key === 'outstanding' ? sort.dir : 'asc'}
              onClick={() => toggleSort('outstanding')}
              align="right"
            />
          </th>
          <th className="py-2 pr-4 text-right font-medium">
            <SortButton
              label={labels.rate}
              active={sort?.key === 'rate'}
              direction={sort?.key === 'rate' ? sort.dir : 'asc'}
              onClick={() => toggleSort('rate')}
              align="right"
            />
          </th>
          <th className="py-2 pr-4 text-right font-medium">
            <SortButton
              label={labels.payment}
              active={sort?.key === 'payment'}
              direction={sort?.key === 'payment' ? sort.dir : 'asc'}
              onClick={() => toggleSort('payment')}
              align="right"
            />
          </th>
          <th className="py-2 pr-4 font-medium">{labels.status}</th>
          <th className="py-2" />
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <tr key={row.debt.id} className="border-glass-line border-t">
            <td className="py-2 pr-4 font-medium text-ink">
              <Link
                href={`/protected/debts/${row.debt.id}`}
                className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                {row.lenderName}
              </Link>
            </td>
            <td className="py-2 pr-4 text-ink-soft">{row.typeLabel}</td>
            <td className="py-2 pr-4 text-right">{row.outstandingLabel}</td>
            <td className="py-2 pr-4 text-right">{row.rateLabel}</td>
            <td className="py-2 pr-4 text-right">{row.paymentLabel}</td>
            <td className="py-2 pr-4">
              <Badge variant={row.statusVariant}>{row.statusLabel}</Badge>
            </td>
            <td className="py-2 text-right">
              <DebtRowActions debt={row.debt} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
