'use client'

import {
  PROPERTY_TYPES,
  type PropertyType,
} from '@finova/domain/real-estate/types'
import { useTranslations } from 'next-intl'
import { useActionState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import type { ActionResult } from './actions'

const KNOWN_ERROR_KEYS = new Set([
  'invalidAmount',
  'invalidDate',
  'invalidPercent',
  'invalidCountry',
  'required',
  'tooLong',
  'endBeforeStart',
])

const SELECT_CLASS =
  'h-11 w-full rounded-2xl border border-glass-line bg-glass px-4 py-2 text-ink text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'] as const

export interface PropertyFormInitial {
  address: string | null
  city: string | null
  id: string
  isRented: boolean
  name: string
  notes: string | null
  ownershipPct: number
  rentalEndDate: string | null
  rentalStartDate: string | null
  type: PropertyType
}

/**
 * Create/edit property form (InvestmentTransactionForm pattern: action
 * injected so the form stays jsdom-testable, zod error keys mapped to i18n).
 * In edit mode, purchase price/fees/current value/currency/country/purchase
 * date are omitted: current value has its own "add valuation" flow, and the
 * others reflect the original transaction and aren't meant to change after
 * the fact.
 */
export function PropertyForm({
  action,
  todayIso,
  onDone,
  mode = 'create',
  initial,
}: {
  action: (
    prev: ActionResult | undefined,
    formData: FormData
  ) => Promise<ActionResult>
  todayIso: string
  onDone?: () => void
  mode?: 'create' | 'edit'
  initial?: PropertyFormInitial
}) {
  const t = useTranslations('realEstate')
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined)

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
  const formError =
    state && !state.ok && !fieldErrors ? t('errors.unexpected') : undefined
  const isEdit = mode === 'edit'

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {isEdit && initial ? (
        <input type="hidden" name="id" value={initial.id} />
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="re-name">{t('form.name')}</Label>
        <Input
          id="re-name"
          name="name"
          placeholder={t('form.namePlaceholder')}
          defaultValue={initial?.name}
          maxLength={120}
          required
        />
        {errorFor('name') ? (
          <p className="text-neg text-xs">{errorFor('name')}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="re-type">{t('form.type')}</Label>
          <select
            id="re-type"
            name="type"
            className={SELECT_CLASS}
            defaultValue={initial?.type}
          >
            {PROPERTY_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`types.${type}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="re-ownership-pct">{t('form.ownershipPct')}</Label>
          <Input
            id="re-ownership-pct"
            name="ownershipPct"
            inputMode="decimal"
            defaultValue={initial?.ownershipPct ?? 100}
            required
          />
          {errorFor('ownershipPct') ? (
            <p className="text-neg text-xs">{errorFor('ownershipPct')}</p>
          ) : null}
        </div>
      </div>

      {isEdit ? null : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="re-currency">{t('form.currency')}</Label>
            <select id="re-currency" name="currency" className={SELECT_CLASS}>
              {CURRENCIES.map((ccy) => (
                <option key={ccy} value={ccy}>
                  {ccy}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="re-purchase-date">{t('form.purchaseDate')}</Label>
            <Input
              id="re-purchase-date"
              name="purchaseDate"
              type="date"
              max={todayIso}
              required
            />
            {errorFor('purchaseDate') ? (
              <p className="text-neg text-xs">{errorFor('purchaseDate')}</p>
            ) : null}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="re-address">{t('form.address')}</Label>
          <Input
            id="re-address"
            name="address"
            defaultValue={initial?.address ?? undefined}
            maxLength={200}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="re-city">{t('form.city')}</Label>
          <Input
            id="re-city"
            name="city"
            defaultValue={initial?.city ?? undefined}
            maxLength={80}
          />
        </div>
      </div>

      {isEdit ? null : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="re-country">{t('form.country')}</Label>
            <Input
              id="re-country"
              name="country"
              defaultValue="ES"
              maxLength={2}
              className="uppercase"
            />
            {errorFor('country') ? (
              <p className="text-neg text-xs">{errorFor('country')}</p>
            ) : null}
          </div>
        </div>
      )}

      {isEdit ? null : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="re-purchase-price">{t('form.purchasePrice')}</Label>
            <Input
              id="re-purchase-price"
              name="purchasePrice"
              inputMode="decimal"
              required
            />
            {errorFor('purchasePrice') ? (
              <p className="text-neg text-xs">{errorFor('purchasePrice')}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="re-purchase-fees">{t('form.purchaseFees')}</Label>
            <Input
              id="re-purchase-fees"
              name="purchaseFees"
              inputMode="decimal"
              placeholder="0"
            />
            {errorFor('purchaseFees') ? (
              <p className="text-neg text-xs">{errorFor('purchaseFees')}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="re-current-value">{t('form.currentValue')}</Label>
            <Input
              id="re-current-value"
              name="currentValue"
              inputMode="decimal"
              required
            />
            {errorFor('currentValue') ? (
              <p className="text-neg text-xs">{errorFor('currentValue')}</p>
            ) : null}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id="re-is-rented"
          name="isRented"
          defaultChecked={initial?.isRented}
        />
        <Label htmlFor="re-is-rented">{t('form.isRented')}</Label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="re-rental-start">{t('form.rentalStartDate')}</Label>
          <Input
            id="re-rental-start"
            name="rentalStartDate"
            type="date"
            defaultValue={initial?.rentalStartDate ?? undefined}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="re-rental-end">{t('form.rentalEndDate')}</Label>
          <Input
            id="re-rental-end"
            name="rentalEndDate"
            type="date"
            defaultValue={initial?.rentalEndDate ?? undefined}
          />
          {errorFor('rentalEndDate') ? (
            <p className="text-neg text-xs">{errorFor('rentalEndDate')}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="re-notes">{t('form.notes')}</Label>
        <Input
          id="re-notes"
          name="notes"
          defaultValue={initial?.notes ?? undefined}
          maxLength={500}
        />
      </div>

      {formError ? <p className="text-neg text-sm">{formError}</p> : null}

      <Button type="submit" disabled={pending}>
        {isEdit ? t('form.submitEdit') : t('form.submit')}
      </Button>
    </form>
  )
}
