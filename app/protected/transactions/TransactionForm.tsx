'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { categoryLabel } from '@/lib/domain/categories/label'
import type { AccountRow } from '@/lib/validation/account'
import type { CategoryRow } from '@/lib/validation/category'
import type { TransactionRow } from '@/lib/validation/transaction'
import {
  type ActionResult,
  createTransaction,
  updateTransaction,
} from './actions'

const SELECT_CLASS =
  'h-11 w-full rounded-2xl border border-glass-line bg-glass px-4 py-2 text-ink text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

/** Validation message keys the form knows how to localize precisely. */
const KNOWN_ERROR_KEYS = new Set([
  'descriptionRequired',
  'descriptionTooLong',
  'noteTooLong',
  'invalidCurrency',
  'invalidAmount',
  'amountNonZero',
])

/** YYYY-MM-DD for a date input, in UTC. */
function toDateInput(iso: string): string {
  return iso.slice(0, 10)
}

export function TransactionForm({
  transaction,
  accounts,
  categories,
  baseCurrency,
  todayIso,
  onDone,
}: {
  transaction?: TransactionRow
  accounts: AccountRow[]
  categories: CategoryRow[]
  baseCurrency: string
  /** Today's date as YYYY-MM-DD (computed on the server to avoid hydration drift). */
  todayIso: string
  onDone?: () => void
}) {
  const t = useTranslations('transactions')
  const tCat = useTranslations('categories.defaults')
  const isEdit = Boolean(transaction)
  const action = isEdit ? updateTransaction : createTransaction
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined)

  const [direction, setDirection] = useState<'income' | 'expense'>(
    transaction && transaction.amount_cents < 0 ? 'expense' : 'income'
  )

  useEffect(() => {
    if (state?.ok) {
      onDone?.()
    }
  }, [state, onDone])

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined
  const topError =
    state && !state.ok && !state.fieldErrors ? state.error : undefined
  const errorFor = (field: string): string | undefined => {
    const msg = fieldErrors?.[field]
    if (!msg) {
      return undefined
    }
    return KNOWN_ERROR_KEYS.has(msg) ? t(`errors.${msg}`) : t('errors.invalid')
  }

  const amountDefault = transaction
    ? (Math.abs(transaction.amount_cents) / 100).toFixed(2)
    : ''
  const currencyDefault =
    transaction?.currency ?? accounts[0]?.currency ?? baseCurrency
  const dateDefault = transaction
    ? toDateInput(transaction.occurred_at)
    : todayIso

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {isEdit && transaction ? (
        <input type="hidden" name="id" value={transaction.id} />
      ) : null}
      <input type="hidden" name="direction" value={direction} />

      {topError ? (
        <p className="text-neg text-sm">
          {topError === 'forbiddenRef'
            ? t('errors.forbiddenRef')
            : t('errors.unexpected')}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-account">{t('fields.account')}</Label>
        <select
          id="tx-account"
          name="accountId"
          defaultValue={transaction?.account_id ?? accounts[0]?.id ?? ''}
          className={SELECT_CLASS}
          required
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {errorFor('accountId') ? (
          <p className="text-neg text-xs">{t('errors.invalid')}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-direction">{t('fields.direction')}</Label>
        <div className="inline-flex gap-1 self-start rounded-full bg-glass p-1">
          {(['income', 'expense'] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={direction === d}
              onClick={() => setDirection(d)}
              className={`rounded-full px-4 py-1.5 font-medium text-sm transition-colors ${
                direction === d
                  ? 'bg-brand text-white shadow-soft'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              {t(`types.${d}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="tx-amount">{t('fields.amount')}</Label>
          <Input
            id="tx-amount"
            name="amount"
            inputMode="decimal"
            defaultValue={amountDefault}
            placeholder="0.00"
            required
          />
          {errorFor('amount') ? (
            <p className="text-neg text-xs">{errorFor('amount')}</p>
          ) : null}
        </div>
        <div className="flex w-28 flex-col gap-1.5">
          <Label htmlFor="tx-currency">{t('fields.currency')}</Label>
          <Input
            id="tx-currency"
            name="currency"
            defaultValue={currencyDefault}
            maxLength={3}
            className="uppercase"
          />
          {errorFor('currency') ? (
            <p className="text-neg text-xs">{errorFor('currency')}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-category">{t('fields.category')}</Label>
        <select
          id="tx-category"
          name="categoryId"
          defaultValue={transaction?.category_id ?? ''}
          className={SELECT_CLASS}
        >
          <option value="">{t('uncategorized')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {categoryLabel(c, tCat)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-date">{t('fields.occurredAt')}</Label>
        <Input
          id="tx-date"
          name="occurredAt"
          type="date"
          defaultValue={dateDefault}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-description">{t('fields.description')}</Label>
        <Input
          id="tx-description"
          name="description"
          defaultValue={transaction?.description ?? ''}
          maxLength={200}
          required
        />
        {errorFor('description') ? (
          <p className="text-neg text-xs">{errorFor('description')}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-tags">{t('fields.tags')}</Label>
        <Input
          id="tx-tags"
          name="tags"
          defaultValue={transaction?.tags.join(', ') ?? ''}
          placeholder={t('tagsPlaceholder')}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-note">{t('fields.note')}</Label>
        <textarea
          id="tx-note"
          name="note"
          defaultValue={transaction?.note ?? ''}
          maxLength={2000}
          rows={2}
          className="w-full rounded-2xl border border-glass-line bg-glass px-4 py-2 text-ink text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
        {errorFor('note') ? (
          <p className="text-neg text-xs">{errorFor('note')}</p>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-ink text-sm">
        <input
          type="checkbox"
          name="isRecurring"
          defaultChecked={transaction?.is_recurring ?? false}
          className="h-4 w-4 rounded border-glass-line"
        />
        {t('fields.isRecurring')}
      </label>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {isEdit ? t('save') : t('create')}
        </Button>
        {onDone ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            {t('cancel')}
          </Button>
        ) : null}
      </div>
    </form>
  )
}
