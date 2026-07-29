'use client'

import type { DebtRow } from '@/lib/validation/debts'
import { deleteLoan } from '../actions'
import { DeleteRowButton } from './DeleteRowButton'
import { EditLoanButton } from './EntryForms'

export function LoanRowActions({ loan }: { loan: DebtRow }) {
  return (
    <span className="inline-flex items-center gap-3">
      <EditLoanButton loan={loan} />
      <DeleteRowButton action={deleteLoan} id={loan.id} />
    </span>
  )
}
