'use client'

import { MANUAL_ASSET_TYPES } from '@finova/domain/manual-assets/types'
import { useTranslations } from 'next-intl'
import { useActionState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import type { ActionResult } from './actions'

const KNOWN_ERROR_KEYS = new Set([
  'invalidAmount',
  'invalidDate',
  'required',
  'tooLong',
])

const SELECT_CLASS =
  'h-11 w-full rounded-2xl border border-glass-line bg-glass px-4 py-2 text-ink text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'] as const

/** Create-asset form (PropertyForm pattern: action injected, zod error keys mapped to i18n). */
export function ManualAssetForm({
  action,
  todayIso,
  onDone,
}: {
  action: (
    prev: ActionResult | undefined,
    formData: FormData
  ) => Promise<ActionResult>
  todayIso: string
  onDone?: () => void
}) {
  const t = useTranslations('manualAssets')
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(async (prevState, formData) => {
    const result = await action(prevState, formData)
    if (result.ok) {
      onDone?.()
    }
    return result
  }, undefined)

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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ma-name">{t('form.name')}</Label>
        <Input
          id="ma-name"
          name="name"
          placeholder={t('form.namePlaceholder')}
          maxLength={120}
          required
        />
        {errorFor('name') ? (
          <p className="text-neg text-xs">{errorFor('name')}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ma-type">{t('form.type')}</Label>
          <select id="ma-type" name="type" className={SELECT_CLASS}>
            {MANUAL_ASSET_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`types.${type}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ma-currency">{t('form.currency')}</Label>
          <select id="ma-currency" name="currency" className={SELECT_CLASS}>
            {CURRENCIES.map((ccy) => (
              <option key={ccy} value={ccy}>
                {ccy}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ma-acquisition-date">
            {t('form.acquisitionDate')}
          </Label>
          <Input
            id="ma-acquisition-date"
            name="acquisitionDate"
            type="date"
            max={todayIso}
            required
          />
          {errorFor('acquisitionDate') ? (
            <p className="text-neg text-xs">{errorFor('acquisitionDate')}</p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ma-cost-basis">{t('form.costBasis')}</Label>
          <Input
            id="ma-cost-basis"
            name="costBasis"
            inputMode="decimal"
            required
          />
          {errorFor('costBasis') ? (
            <p className="text-neg text-xs">{errorFor('costBasis')}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ma-current-value">{t('form.currentValue')}</Label>
          <Input
            id="ma-current-value"
            name="currentValue"
            inputMode="decimal"
            required
          />
          {errorFor('currentValue') ? (
            <p className="text-neg text-xs">{errorFor('currentValue')}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ma-notes">{t('form.notes')}</Label>
        <Input id="ma-notes" name="notes" maxLength={500} />
      </div>

      {formError ? <p className="text-neg text-sm">{formError}</p> : null}

      <Button type="submit" disabled={pending}>
        {t('form.submit')}
      </Button>
    </form>
  )
}
