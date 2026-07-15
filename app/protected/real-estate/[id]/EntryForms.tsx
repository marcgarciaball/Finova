'use client'

import { Pencil } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { type ReactNode, useActionState, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { format, money } from '@/lib/domain/money'
import { totalFromMonthlyRentCents } from '@/lib/domain/real-estate/metrics'
import {
  EXPENSE_CATEGORIES,
  LOAN_TYPES,
  RATE_TYPES,
  RECURRENCES,
  VALUATION_SOURCES,
} from '@/lib/domain/real-estate/types'
import type { PropertyLoanRow } from '@/lib/validation/real-estate'
import type { ActionResult } from '../actions'
import {
  createExpense,
  createLoan,
  createRentalIncome,
  createValuation,
  updateLoan,
} from '../actions'
import { AddDialog, Field, SELECT_CLASS } from './FormBits'

const KNOWN_ERROR_KEYS = new Set([
  'invalidAmount',
  'invalidDate',
  'invalidPercent',
  'required',
  'tooLong',
  'endBeforeStart',
])

type FormAction = (
  prev: ActionResult | undefined,
  formData: FormData
) => Promise<ActionResult>

/** useActionState + i18n error mapping, shared by every entry form. */
function useEntryForm(action: FormAction, onDone: () => void) {
  const t = useTranslations('realEstate')
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined)

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
  return { errorFor, formAction, formError, pending }
}

function FormShell({
  formAction,
  formError,
  pending,
  submitLabel,
  children,
}: {
  formAction: (formData: FormData) => void
  formError?: string
  pending: boolean
  submitLabel: string
  children: ReactNode
}) {
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {children}
      {formError ? <p className="text-neg text-sm">{formError}</p> : null}
      <Button type="submit" disabled={pending}>
        {submitLabel}
      </Button>
    </form>
  )
}

export function AddLoanButton({
  propertyId,
  todayIso,
}: {
  propertyId: string
  todayIso: string
}) {
  const t = useTranslations('realEstate')
  return (
    <AddDialog title={t('detail.addLoan')}>
      {(onDone) => (
        <LoanForm propertyId={propertyId} todayIso={todayIso} onDone={onDone} />
      )}
    </AddDialog>
  )
}

function LoanForm({
  propertyId,
  todayIso,
  onDone,
}: {
  propertyId: string
  todayIso: string
  onDone: () => void
}) {
  const t = useTranslations('realEstate')
  const { errorFor, formAction, formError, pending } = useEntryForm(
    createLoan,
    onDone
  )
  return (
    <FormShell
      formAction={formAction}
      formError={formError}
      pending={pending}
      submitLabel={t('loanForm.submit')}
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      <Field
        id="loan-lender"
        label={t('loanForm.lenderName')}
        error={errorFor('lenderName')}
      >
        <Input id="loan-lender" name="lenderName" maxLength={120} required />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="loan-type" label={t('loanForm.loanType')}>
          <select id="loan-type" name="loanType" className={SELECT_CLASS}>
            {LOAN_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`loanForm.loanTypes.${type}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="loan-rate-type" label={t('loanForm.rateType')}>
          <select id="loan-rate-type" name="rateType" className={SELECT_CLASS}>
            {RATE_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`loanForm.rateTypes.${type}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="loan-original"
          label={t('loanForm.originalAmount')}
          error={errorFor('originalAmount')}
        >
          <Input
            id="loan-original"
            name="originalAmount"
            inputMode="decimal"
            required
          />
        </Field>
        <Field
          id="loan-outstanding"
          label={t('loanForm.outstanding')}
          error={errorFor('outstanding')}
        >
          <Input
            id="loan-outstanding"
            name="outstanding"
            inputMode="decimal"
            required
          />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field
          id="loan-rate"
          label={t('loanForm.interestRatePct')}
          error={errorFor('interestRatePct')}
        >
          <Input
            id="loan-rate"
            name="interestRatePct"
            inputMode="decimal"
            required
          />
        </Field>
        <Field
          id="loan-payment"
          label={t('loanForm.monthlyPayment')}
          error={errorFor('monthlyPayment')}
        >
          <Input
            id="loan-payment"
            name="monthlyPayment"
            inputMode="decimal"
            required
          />
        </Field>
        <Field
          id="loan-euribor"
          label={t('loanForm.euriborSpreadPct')}
          error={errorFor('euriborSpreadPct')}
        >
          <Input
            id="loan-euribor"
            name="euriborSpreadPct"
            inputMode="decimal"
          />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="loan-start"
          label={t('loanForm.startDate')}
          error={errorFor('startDate')}
        >
          <Input
            id="loan-start"
            name="startDate"
            type="date"
            max={todayIso}
            required
          />
        </Field>
        <Field id="loan-end" label={t('loanForm.endDate')}>
          <Input id="loan-end" name="endDate" type="date" />
        </Field>
      </div>
      <Field id="loan-notes" label={t('loanForm.notes')}>
        <Input id="loan-notes" name="notes" maxLength={500} />
      </Field>
    </FormShell>
  )
}

/** Balance/rate/payment update for one loan, in a pencil-icon dialog. */
export function EditLoanButton({ loan }: { loan: PropertyLoanRow }) {
  const t = useTranslations('realEstate')
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
          <DialogTitle>{loan.lender_name}</DialogTitle>
        </DialogHeader>
        <EditLoanForm loan={loan} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function EditLoanForm({
  loan,
  onDone,
}: {
  loan: PropertyLoanRow
  onDone: () => void
}) {
  const t = useTranslations('realEstate')
  const { errorFor, formAction, formError, pending } = useEntryForm(
    updateLoan,
    onDone
  )
  return (
    <FormShell
      formAction={formAction}
      formError={formError}
      pending={pending}
      submitLabel={t('loanForm.update')}
    >
      <input type="hidden" name="id" value={loan.id} />
      <Field
        id="edit-loan-outstanding"
        label={t('loanForm.outstanding')}
        error={errorFor('outstanding')}
      >
        <Input
          id="edit-loan-outstanding"
          name="outstanding"
          inputMode="decimal"
          defaultValue={(loan.outstanding_cents / 100).toFixed(2)}
          required
        />
      </Field>
      <Field
        id="edit-loan-rate"
        label={t('loanForm.interestRatePct')}
        error={errorFor('interestRatePct')}
      >
        <Input
          id="edit-loan-rate"
          name="interestRatePct"
          inputMode="decimal"
          defaultValue={String(loan.interest_rate_pct)}
          required
        />
      </Field>
      <Field
        id="edit-loan-payment"
        label={t('loanForm.monthlyPayment')}
        error={errorFor('monthlyPayment')}
      >
        <Input
          id="edit-loan-payment"
          name="monthlyPayment"
          inputMode="decimal"
          defaultValue={(loan.monthly_payment_cents / 100).toFixed(2)}
          required
        />
      </Field>
      <div className="flex items-center gap-2">
        <Checkbox
          id="edit-loan-paid-off"
          name="isPaidOff"
          defaultChecked={loan.is_paid_off}
        />
        <label htmlFor="edit-loan-paid-off" className="text-ink text-sm">
          {t('loanForm.isPaidOff')}
        </label>
      </div>
    </FormShell>
  )
}

export function AddIncomeButton({
  propertyId,
  currency,
  todayIso,
}: {
  propertyId: string
  currency: string
  todayIso: string
}) {
  const t = useTranslations('realEstate')
  return (
    <AddDialog title={t('detail.addIncome')}>
      {(onDone) => (
        <IncomeForm
          propertyId={propertyId}
          currency={currency}
          todayIso={todayIso}
          onDone={onDone}
        />
      )}
    </AddDialog>
  )
}

function IncomeForm({
  propertyId,
  currency,
  todayIso,
  onDone,
}: {
  propertyId: string
  currency: string
  todayIso: string
  onDone: () => void
}) {
  const t = useTranslations('realEstate')
  const locale = useLocale()
  const { errorFor, formAction, formError, pending } = useEntryForm(
    createRentalIncome,
    onDone
  )
  const [amountKind, setAmountKind] = useState<'total' | 'monthly'>('monthly')
  const [amount, setAmount] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')

  // Live preview of the period total when a monthly rent is entered — the
  // exact number the server will store (same domain function).
  let computedTotal: string | null = null
  if (
    amountKind === 'monthly' &&
    /^\d+([.,]\d{1,2})?$/.test(amount.trim()) &&
    periodStart &&
    periodEnd &&
    periodEnd >= periodStart
  ) {
    const monthlyCents = Math.round(
      Number(amount.trim().replace(',', '.')) * 100
    )
    computedTotal = format(
      money(
        totalFromMonthlyRentCents(monthlyCents, periodStart, periodEnd),
        currency
      ),
      locale
    )
  }

  return (
    <FormShell
      formAction={formAction}
      formError={formError}
      pending={pending}
      submitLabel={t('incomeForm.submit')}
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="income-start"
          label={t('incomeForm.periodStart')}
          error={errorFor('periodStart')}
        >
          <Input
            id="income-start"
            name="periodStart"
            type="date"
            max={todayIso}
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            required
          />
        </Field>
        <Field
          id="income-end"
          label={t('incomeForm.periodEnd')}
          error={errorFor('periodEnd')}
        >
          <Input
            id="income-end"
            name="periodEnd"
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            required
          />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="income-amount-kind" label={t('incomeForm.amountKind')}>
          <select
            id="income-amount-kind"
            name="amountKind"
            value={amountKind}
            onChange={(e) =>
              setAmountKind(e.target.value === 'total' ? 'total' : 'monthly')
            }
            className={SELECT_CLASS}
          >
            <option value="monthly">{t('incomeForm.amountKindMonthly')}</option>
            <option value="total">{t('incomeForm.amountKindTotal')}</option>
          </select>
        </Field>
        <Field
          id="income-amount"
          label={
            amountKind === 'monthly'
              ? t('incomeForm.amountMonthly')
              : t('incomeForm.amount')
          }
          error={errorFor('amount')}
        >
          <Input
            id="income-amount"
            name="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </Field>
      </div>
      {computedTotal ? (
        <p className="text-ink-soft text-sm">
          {t('incomeForm.computedTotal', { amount: computedTotal })}
        </p>
      ) : null}
      <Field id="income-tenant" label={t('incomeForm.tenantName')}>
        <Input id="income-tenant" name="tenantName" maxLength={120} />
      </Field>
      <Field id="income-notes" label={t('incomeForm.notes')}>
        <Input id="income-notes" name="notes" maxLength={500} />
      </Field>
    </FormShell>
  )
}

export function AddExpenseButton({
  propertyId,
  todayIso,
}: {
  propertyId: string
  todayIso: string
}) {
  const t = useTranslations('realEstate')
  return (
    <AddDialog title={t('detail.addExpense')}>
      {(onDone) => (
        <ExpenseForm
          propertyId={propertyId}
          todayIso={todayIso}
          onDone={onDone}
        />
      )}
    </AddDialog>
  )
}

function ExpenseForm({
  propertyId,
  todayIso,
  onDone,
}: {
  propertyId: string
  todayIso: string
  onDone: () => void
}) {
  const t = useTranslations('realEstate')
  const { errorFor, formAction, formError, pending } = useEntryForm(
    createExpense,
    onDone
  )
  const [recurring, setRecurring] = useState(false)
  return (
    <FormShell
      formAction={formAction}
      formError={formError}
      pending={pending}
      submitLabel={t('expenseForm.submit')}
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="expense-category" label={t('expenseForm.category')}>
          <select
            id="expense-category"
            name="category"
            defaultValue="property_tax"
            className={SELECT_CLASS}
          >
            {EXPENSE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t(`expenseForm.categories.${category}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="expense-date"
          label={t('expenseForm.expenseDate')}
          error={errorFor('expenseDate')}
        >
          <Input
            id="expense-date"
            name="expenseDate"
            type="date"
            max={todayIso}
            required
          />
        </Field>
      </div>
      <Field
        id="expense-description"
        label={t('expenseForm.description')}
        error={errorFor('description')}
      >
        <Input
          id="expense-description"
          name="description"
          maxLength={200}
          required
        />
      </Field>
      <Field
        id="expense-amount"
        label={t('expenseForm.amount')}
        error={errorFor('amount')}
      >
        <Input id="expense-amount" name="amount" inputMode="decimal" required />
      </Field>
      <div className="flex items-center gap-2">
        <Checkbox
          id="expense-recurring"
          name="isRecurring"
          checked={recurring}
          onCheckedChange={(v) => setRecurring(v === true)}
        />
        <label htmlFor="expense-recurring" className="text-ink text-sm">
          {t('expenseForm.isRecurring')}
        </label>
      </div>
      {recurring ? (
        <Field
          id="expense-recurrence"
          label={t('expenseForm.recurrence')}
          error={errorFor('recurrence')}
        >
          <select
            id="expense-recurrence"
            name="recurrence"
            className={SELECT_CLASS}
          >
            {RECURRENCES.map((r) => (
              <option key={r} value={r}>
                {t(`expenseForm.recurrences.${r}`)}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field id="expense-notes" label={t('expenseForm.notes')}>
        <Input id="expense-notes" name="notes" maxLength={500} />
      </Field>
    </FormShell>
  )
}

export function AddValuationButton({
  propertyId,
  todayIso,
}: {
  propertyId: string
  todayIso: string
}) {
  const t = useTranslations('realEstate')
  return (
    <AddDialog title={t('detail.addValuation')}>
      {(onDone) => (
        <ValuationForm
          propertyId={propertyId}
          todayIso={todayIso}
          onDone={onDone}
        />
      )}
    </AddDialog>
  )
}

function ValuationForm({
  propertyId,
  todayIso,
  onDone,
}: {
  propertyId: string
  todayIso: string
  onDone: () => void
}) {
  const t = useTranslations('realEstate')
  const { errorFor, formAction, formError, pending } = useEntryForm(
    createValuation,
    onDone
  )
  return (
    <FormShell
      formAction={formAction}
      formError={formError}
      pending={pending}
      submitLabel={t('valuationForm.submit')}
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="valuation-date"
          label={t('valuationForm.valuationDate')}
          error={errorFor('valuationDate')}
        >
          <Input
            id="valuation-date"
            name="valuationDate"
            type="date"
            defaultValue={todayIso}
            max={todayIso}
            required
          />
        </Field>
        <Field
          id="valuation-value"
          label={t('valuationForm.value')}
          error={errorFor('value')}
        >
          <Input
            id="valuation-value"
            name="value"
            inputMode="decimal"
            required
          />
        </Field>
      </div>
      <Field id="valuation-source" label={t('valuationForm.source')}>
        <select id="valuation-source" name="source" className={SELECT_CLASS}>
          {VALUATION_SOURCES.map((source) => (
            <option key={source} value={source}>
              {t(`valuationForm.sources.${source}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field id="valuation-notes" label={t('valuationForm.notes')}>
        <Input id="valuation-notes" name="notes" maxLength={500} />
      </Field>
    </FormShell>
  )
}
