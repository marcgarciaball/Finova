'use client'

import { useTranslations } from 'next-intl'
import { useActionState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import type { ResolvedAsset } from '@/lib/investments/asset-option'
import type { ActionResult } from './actions'

const KNOWN_ERROR_KEYS = new Set([
  'invalidAmount',
  'tooManyDecimals',
  'mustBePositive',
  'invalidDate',
  'futureDate',
  'invalidCurrency',
  'notesTooLong',
  'oversell',
  'mixedCurrency',
])

const SELECT_CLASS =
  'h-11 w-full rounded-2xl border border-glass-line bg-glass px-4 py-2 text-ink text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

/** Existing row values when the form edits instead of creates. */
export interface TxnDefaults {
  currency: string
  fees: string
  id: string
  notes: string
  price: string
  quantity: string
  tradedAt: string
  type: 'buy' | 'sell'
}

/**
 * Buy/sell entry for one resolved asset (Inversiones A4). The action is
 * injected so the form stays jsdom-testable (ProfileForm pattern). With `txn`
 * set it edits that row (adds the id + optional audit reason).
 */
export function InvestmentTransactionForm({
  action,
  asset,
  todayIso,
  txn,
}: {
  action: (
    prev: ActionResult | undefined,
    formData: FormData
  ) => Promise<ActionResult>
  asset: ResolvedAsset
  todayIso: string
  txn?: TxnDefaults
}) {
  const t = useTranslations('investments')
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined)

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
      <input type="hidden" name="assetId" value={asset.id} />
      {txn ? <input type="hidden" name="id" value={txn.id} /> : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inv-type">{t('form.type')}</Label>
        <select
          id="inv-type"
          name="type"
          defaultValue={txn?.type ?? 'buy'}
          className={SELECT_CLASS}
        >
          <option value="buy">{t('form.buy')}</option>
          <option value="sell">{t('form.sell')}</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inv-traded-at">{t('form.date')}</Label>
        <Input
          id="inv-traded-at"
          name="tradedAt"
          type="date"
          defaultValue={txn?.tradedAt ?? todayIso}
          max={todayIso}
          required
        />
        {errorFor('tradedAt') ? (
          <p className="text-neg text-xs">{errorFor('tradedAt')}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inv-quantity">{t('form.quantity')}</Label>
        <Input
          id="inv-quantity"
          name="quantity"
          inputMode="decimal"
          defaultValue={txn?.quantity}
          required
        />
        {errorFor('quantity') ? (
          <p className="text-neg text-xs">{errorFor('quantity')}</p>
        ) : null}
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="inv-price">{t('form.price')}</Label>
          <Input
            id="inv-price"
            name="price"
            inputMode="decimal"
            defaultValue={txn?.price}
            required
          />
          {errorFor('price') ? (
            <p className="text-neg text-xs">{errorFor('price')}</p>
          ) : null}
        </div>
        <div className="flex w-28 flex-col gap-1.5">
          <Label htmlFor="inv-currency">{t('form.currency')}</Label>
          <Input
            id="inv-currency"
            name="currency"
            defaultValue={txn?.currency ?? asset.currency}
            maxLength={3}
            className="uppercase"
          />
          {errorFor('currency') ? (
            <p className="text-neg text-xs">{errorFor('currency')}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inv-fees">{t('form.fees')}</Label>
        <Input
          id="inv-fees"
          name="fees"
          inputMode="decimal"
          defaultValue={txn?.fees ?? '0'}
        />
        {errorFor('fees') ? (
          <p className="text-neg text-xs">{errorFor('fees')}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inv-notes">{t('form.notes')}</Label>
        <Input
          id="inv-notes"
          name="notes"
          maxLength={500}
          defaultValue={txn?.notes}
        />
      </div>

      {txn ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inv-edit-reason">{t('form.editReason')}</Label>
          <Input id="inv-edit-reason" name="editReason" maxLength={200} />
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {txn ? t('form.save') : t('form.submit')}
        </Button>
        {state?.ok ? (
          <p className="text-ink-soft text-sm">{t('form.saved')}</p>
        ) : null}
        {formError ? <p className="text-neg text-sm">{formError}</p> : null}
      </div>
    </form>
  )
}
