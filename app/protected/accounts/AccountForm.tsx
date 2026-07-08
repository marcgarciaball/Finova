'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { ACCOUNT_TYPES } from '@/lib/domain/accounts/types'
import type { AccountRow } from '@/lib/validation/account'
import { type ActionResult, createAccount, updateAccount } from './actions'

/** Map a validation message key from the action to a localized string. */
const KNOWN_ERROR_KEYS = new Set([
  'nameRequired',
  'nameTooLong',
  'invalidCurrency',
  'invalidAmount',
  'invalidRate',
])

export function AccountForm({
  account,
  baseCurrency,
  onDone,
}: {
  account?: AccountRow
  baseCurrency: string
  onDone?: () => void
}) {
  const t = useTranslations('accounts')
  const isEdit = Boolean(account)
  const action = isEdit ? updateAccount : createAccount
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined)

  // Close / reset on success.
  useEffect(() => {
    if (state?.ok) {
      onDone?.()
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

  const balanceDefault = account
    ? (account.opening_balance / 100).toFixed(2)
    : '0'
  const interestRateDefault =
    account?.interest_rate_bps != null
      ? (account.interest_rate_bps / 100).toString()
      : ''

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {isEdit && account ? (
        <input type="hidden" name="id" value={account.id} />
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-name">{t('fields.name')}</Label>
        <Input
          id="account-name"
          name="name"
          defaultValue={account?.name ?? ''}
          required
          maxLength={100}
        />
        {errorFor('name') ? (
          <p className="text-neg text-xs">{errorFor('name')}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-type">{t('fields.type')}</Label>
        <select
          id="account-type"
          name="type"
          defaultValue={account?.type ?? 'checking'}
          className="h-11 w-full rounded-2xl border border-glass-line bg-glass px-4 py-2 text-ink text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {ACCOUNT_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`types.${type}`)}
            </option>
          ))}
        </select>
        {errorFor('type') ? (
          <p className="text-neg text-xs">{errorFor('type')}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-currency">{t('fields.currency')}</Label>
        <Input
          id="account-currency"
          name="currency"
          defaultValue={account?.currency ?? baseCurrency}
          maxLength={3}
          className="uppercase"
        />
        {errorFor('currency') ? (
          <p className="text-neg text-xs">{errorFor('currency')}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-opening-balance">
          {t('fields.openingBalance')}
        </Label>
        <Input
          id="account-opening-balance"
          name="openingBalance"
          inputMode="decimal"
          defaultValue={balanceDefault}
        />
        {errorFor('openingBalance') ? (
          <p className="text-neg text-xs">{errorFor('openingBalance')}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-interest-rate">
          {t('fields.interestRate')}
        </Label>
        <Input
          id="account-interest-rate"
          name="interestRate"
          inputMode="decimal"
          placeholder="0"
          defaultValue={interestRateDefault}
        />
        <p className="text-ink-soft text-xs">{t('fields.interestRateNote')}</p>
        {errorFor('interestRate') ? (
          <p className="text-neg text-xs">{errorFor('interestRate')}</p>
        ) : null}
      </div>

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
