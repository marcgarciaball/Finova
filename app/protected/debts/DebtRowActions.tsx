'use client'

import type { DebtRow } from '@/lib/validation/debts'
import { deleteDebt } from './actions'
import { DeleteRowButton } from './DeleteRowButton'
import { EditDebtButton } from './EditDebtForm'

export function DebtRowActions({ debt }: { debt: DebtRow }) {
  return (
    <span className="inline-flex items-center gap-3">
      <EditDebtButton debt={debt} />
      <DeleteRowButton action={deleteDebt} id={debt.id} />
    </span>
  )
}
