'use client'

import type { RentalIncomeRow } from '@/lib/validation/real-estate'
import { deleteRentalIncome } from '../actions'
import { DeleteRowButton } from './DeleteRowButton'
import { EditIncomeButton } from './EntryForms'

export function IncomeRowActions({ income }: { income: RentalIncomeRow }) {
  return (
    <span className="inline-flex items-center gap-3">
      <EditIncomeButton income={income} />
      <DeleteRowButton action={deleteRentalIncome} id={income.id} />
    </span>
  )
}
