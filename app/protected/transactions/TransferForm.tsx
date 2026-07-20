'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import type { AccountRow } from '@/lib/validation/account'
import { type ActionResult, createTransfer } from './actions'

const SELECT_CLASS =
  'h-11 w-full rounded-2xl border border-glass-line bg-glass px-4 py-2 text-ink text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

const KNOWN_ERROR_KEYS = new Set([
  'descriptionRequired',
  'descriptionTooLong',
  'invalidCurrency',
  'invalidAmount',
  'amountNonZero',
])

/**
 * Two-leg transfer wizard (roadmap 1.2): "move money A→B" as a single form —
 * pick source + destination accounts, an amount, a date, and a description;
 * `createTransfer` writes both legs atomically as one insert.
 */
export function TransferForm({
  accounts,
  baseCurrency,
  todayIso,
  onDone,
}: {
  accounts: AccountRow[]
  baseCurrency: string
  todayIso: string
  onDone?: () => void
}) {
  const t = useTranslations('transactions')
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(createTransfer, undefined)

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

  const currencyDefault = accounts[0]?.currency ?? baseCurrency
  const topErrorMessage =
    topError === 'forbiddenRef'
      ? t('errors.forbiddenRef')
      : topError === 'sameAccount'
        ? t('transfer.sameAccount')
        : topError
          ? t('errors.unexpected')
          : undefined

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {topErrorMessage ? (
        <p className="text-neg text-sm">{topErrorMessage}</p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="transfer-from">{t('transfer.from')}</Label>
        <select
          id="transfer-from"
          name="fromAccountId"
          defaultValue={accounts[0]?.id ?? ''}
          className={SELECT_CLASS}
          required
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="transfer-to">{t('transfer.to')}</Label>
        <select
          id="transfer-to"
          name="toAccountId"
          defaultValue={accounts[1]?.id ?? accounts[0]?.id ?? ''}
          className={SELECT_CLASS}
          required
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="transfer-amount">{t('fields.amount')}</Label>
          <Input
            id="transfer-amount"
            name="amount"
            inputMode="decimal"
            placeholder="0.00"
            required
          />
          {errorFor('amount') ? (
            <p className="text-neg text-xs">{errorFor('amount')}</p>
          ) : null}
        </div>
        <div className="flex w-28 flex-col gap-1.5">
          <Label htmlFor="transfer-currency">{t('fields.currency')}</Label>
          <Input
            id="transfer-currency"
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
        <Label htmlFor="transfer-date">{t('fields.occurredAt')}</Label>
        <Input
          id="transfer-date"
          name="occurredAt"
          type="date"
          defaultValue={todayIso}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="transfer-description">{t('fields.description')}</Label>
        <Input
          id="transfer-description"
          name="description"
          defaultValue={t('transfer.defaultDescription')}
          maxLength={200}
          required
        />
        {errorFor('description') ? (
          <p className="text-neg text-xs">{errorFor('description')}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {t('transfer.submit')}
        </Button>
        {onDone ? (
          <Button type="button" variant="ghost" onClick={() => onDone?.()}>
            {t('cancel')}
          </Button>
        ) : null}
      </div>
    </form>
  )
}
