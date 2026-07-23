'use client'

import { Badge } from '@/components/ui/Badge'
import { SortButton } from '@/components/ui/table/SortButton'
import { useClientSort } from '@/lib/hooks/useClientSort'
import type { PropertyLoanRow } from '@/lib/validation/real-estate'
import { LoanRowActions } from './LoanRowActions'

export interface LoanRowView {
  lenderName: string
  loan: PropertyLoanRow
  outstandingCents: number
  outstandingLabel: string
  paidOffLabel: string
  paymentCents: number
  paymentLabel: string
  rateLabel: string
  ratePct: number
  rateTypeLabel: string
  typeLabel: string
}

export function LoansTable({
  rows,
  labels,
}: {
  rows: LoanRowView[]
  labels: {
    lender: string
    type: string
    outstanding: string
    rate: string
    payment: string
  }
}) {
  const { sort, sorted, toggleSort } = useClientSort<
    LoanRowView,
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
          <th className="py-2" />
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <tr key={row.loan.id} className="border-glass-line border-t">
            <td className="py-2 pr-4 font-medium text-ink">
              {row.lenderName}
              {row.loan.is_paid_off ? (
                <Badge variant="neutral" className="ml-2">
                  {row.paidOffLabel}
                </Badge>
              ) : null}
            </td>
            <td className="py-2 pr-4 text-ink-soft">{row.typeLabel}</td>
            <td className="py-2 pr-4 text-right">{row.outstandingLabel}</td>
            <td className="py-2 pr-4 text-right">
              {row.rateLabel}{' '}
              <span className="text-ink-soft text-xs">{row.rateTypeLabel}</span>
            </td>
            <td className="py-2 pr-4 text-right">{row.paymentLabel}</td>
            <td className="py-2 text-right">
              <LoanRowActions loan={row.loan} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
