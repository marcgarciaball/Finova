'use client'

import { DEBT_STATUSES } from '@finova/domain/debts/types'
import { Pencil } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import type { DebtRow } from '@/lib/validation/debts'
import type { ActionResult } from './actions'
import { updateDebt } from './actions'
import { Field, SELECT_CLASS } from './FormBits'

const KNOWN_ERROR_KEYS = new Set([
  'invalidAmount',
  'invalidPercent',
  'required',
  'tooLong',
])

/** Balance/rate/payment/status update for one debt, in a pencil-icon dialog. */
export function EditDebtButton({ debt }: { debt: DebtRow }) {
  const t = useTranslations('debts')
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={t('detail.edit')}
          className="text-ink-soft transition-colors hover:text-ink"
        >
          <Pencil className="size-4" aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{debt.lender}</DialogTitle>
        </DialogHeader>
        <EditDebtForm debt={debt} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function EditDebtForm({ debt, onDone }: { debt: DebtRow; onDone: () => void }) {
  const t = useTranslations('debts')
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(updateDebt, undefined)

  useEffect(() => {
    if (state?.ok) {
      onDone()
    }
  }, [state, onDone])

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined
  const errorFor = (field: string): string | undefined => {
    const msg = fieldErrors?.[field]
    if (!msg) {
      return undefined
    }
    return KNOWN_ERROR_KEYS.has(msg) ? t(`errors.${msg}`) : t('errors.invalid')
  }
  const formError =
    state && !state.ok && !fieldErrors ? t('errors.unexpected') : undefined

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={debt.id} />
      <Field
        id="edit-debt-lender"
        label={t('form.lender')}
        error={errorFor('lender')}
      >
        <Input
          id="edit-debt-lender"
          name="lender"
          defaultValue={debt.lender}
          maxLength={120}
          required
        />
      </Field>
      <Field
        id="edit-debt-outstanding"
        label={t('form.outstanding')}
        error={errorFor('outstanding')}
      >
        <Input
          id="edit-debt-outstanding"
          name="outstanding"
          inputMode="decimal"
          defaultValue={(debt.outstanding_cents / 100).toFixed(2)}
          required
        />
      </Field>
      <Field
        id="edit-debt-rate"
        label={t('form.interestRatePct')}
        error={errorFor('interestRatePct')}
      >
        <Input
          id="edit-debt-rate"
          name="interestRatePct"
          inputMode="decimal"
          defaultValue={String(debt.interest_rate_pct)}
          required
        />
      </Field>
      <Field
        id="edit-debt-payment"
        label={t('form.payment')}
        error={errorFor('payment')}
      >
        <Input
          id="edit-debt-payment"
          name="payment"
          inputMode="decimal"
          defaultValue={(debt.payment_cents / 100).toFixed(2)}
          required
        />
      </Field>
      <Field id="edit-debt-status" label={t('form.status')}>
        <select
          id="edit-debt-status"
          name="status"
          defaultValue={debt.status}
          className={SELECT_CLASS}
        >
          {DEBT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`statuses.${status}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field id="edit-debt-notes" label={t('form.notes')}>
        <Input
          id="edit-debt-notes"
          name="notes"
          defaultValue={debt.notes ?? ''}
          maxLength={500}
        />
      </Field>
      {formError ? <p className="text-neg text-sm">{formError}</p> : null}
      <Button type="submit" disabled={pending}>
        {t('form.update')}
      </Button>
    </form>
  )
}
