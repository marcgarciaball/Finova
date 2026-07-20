'use client'

import type { PropertyLoanRow } from '@/lib/validation/real-estate'
import { deleteLoan } from '../actions'
import { DeleteRowButton } from './DeleteRowButton'
import { EditLoanButton } from './EntryForms'

export function LoanRowActions({ loan }: { loan: PropertyLoanRow }) {
  return (
    <span className="inline-flex items-center gap-3">
      <EditLoanButton loan={loan} />
      <DeleteRowButton action={deleteLoan} id={loan.id} />
    </span>
  )
}
