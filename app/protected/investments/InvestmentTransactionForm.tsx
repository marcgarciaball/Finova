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

/**
 * Buy/sell entry for one resolved asset (Inversiones A4). The action is
 * injected so the form stays jsdom-testable (ProfileForm pattern).
 */
export function InvestmentTransactionForm({
  action,
  asset,
  todayIso,
}: {
  action: (
    prev: ActionResult | undefined,
    formData: FormData
  ) => Promise<ActionResult>
  asset: ResolvedAsset
  todayIso: string
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inv-type">{t('form.type')}</Label>
        <select
          id="inv-type"
          name="type"
          defaultValue="buy"
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
          defaultValue={todayIso}
          max={todayIso}
          required
        />
        {errorFor('tradedAt') ? (
          <p className="text-neg text-xs">{errorFor('tradedAt')}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inv-quantity">{t('form.quantity')}</Label>
        <Input id="inv-quantity" name="quantity" inputMode="decimal" required />
        {errorFor('quantity') ? (
          <p className="text-neg text-xs">{errorFor('quantity')}</p>
        ) : null}
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="inv-price">{t('form.price')}</Label>
          <Input id="inv-price" name="price" inputMode="decimal" required />
          {errorFor('price') ? (
            <p className="text-neg text-xs">{errorFor('price')}</p>
          ) : null}
        </div>
        <div className="flex w-28 flex-col gap-1.5">
          <Label htmlFor="inv-currency">{t('form.currency')}</Label>
          <Input
            id="inv-currency"
            name="currency"
            defaultValue={asset.currency}
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
        <Input id="inv-fees" name="fees" inputMode="decimal" defaultValue="0" />
        {errorFor('fees') ? (
          <p className="text-neg text-xs">{errorFor('fees')}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inv-notes">{t('form.notes')}</Label>
        <Input id="inv-notes" name="notes" maxLength={500} />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {t('form.submit')}
        </Button>
        {state?.ok ? (
          <p className="text-ink-soft text-sm">{t('form.saved')}</p>
        ) : null}
        {formError ? <p className="text-neg text-sm">{formError}</p> : null}
      </div>
    </form>
  )
}
