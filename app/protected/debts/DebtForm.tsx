'use client'

import { DEBT_RATE_TYPES, DEBT_TYPES } from '@finova/domain/debts/types'
import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { ActionResult } from './actions'
import { createDebt } from './actions'
import { Field, SELECT_CLASS } from './FormBits'

const KNOWN_ERROR_KEYS = new Set([
  'invalidAmount',
  'invalidDate',
  'invalidPercent',
  'required',
  'tooLong',
])

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'] as const

/** Create-debt form: mirrors ManualAssetForm's action-injected/error-mapped pattern. */
export function DebtForm({
  properties,
  todayIso,
  onDone,
}: {
  properties: { id: string; name: string }[]
  todayIso: string
  onDone?: () => void
}) {
  const t = useTranslations('debts')
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(createDebt, undefined)
  const [type, setType] = useState<(typeof DEBT_TYPES)[number]>('mortgage')

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

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="debt-type" label={t('form.type')}>
          <select
            id="debt-type"
            name="type"
            value={type}
            onChange={(e) =>
              setType(e.target.value as (typeof DEBT_TYPES)[number])
            }
            className={SELECT_CLASS}
          >
            {DEBT_TYPES.map((debtType) => (
              <option key={debtType} value={debtType}>
                {t(`types.${debtType}`)}
              </option>
            ))}
          </select>
        </Field>
        {type === 'mortgage' ? (
          <Field
            id="debt-property"
            label={t('form.property')}
            error={errorFor('propertyId')}
          >
            <select
              id="debt-property"
              name="propertyId"
              className={SELECT_CLASS}
              required
            >
              <option value="">{t('form.propertyPlaceholder')}</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="debt-lender"
          label={t('form.lender')}
          error={errorFor('lender')}
        >
          <Input id="debt-lender" name="lender" maxLength={120} required />
        </Field>
        <Field id="debt-currency" label={t('form.currency')}>
          <select id="debt-currency" name="currency" className={SELECT_CLASS}>
            {CURRENCIES.map((ccy) => (
              <option key={ccy} value={ccy}>
                {ccy}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="debt-principal"
          label={t('form.principal')}
          error={errorFor('principal')}
        >
          <Input
            id="debt-principal"
            name="principal"
            inputMode="decimal"
            required
          />
        </Field>
        <Field
          id="debt-outstanding"
          label={t('form.outstanding')}
          error={errorFor('outstanding')}
        >
          <Input
            id="debt-outstanding"
            name="outstanding"
            inputMode="decimal"
            required
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field
          id="debt-rate"
          label={t('form.interestRatePct')}
          error={errorFor('interestRatePct')}
        >
          <Input
            id="debt-rate"
            name="interestRatePct"
            inputMode="decimal"
            required
          />
        </Field>
        <Field id="debt-rate-type" label={t('form.rateType')}>
          <select id="debt-rate-type" name="rateType" className={SELECT_CLASS}>
            {DEBT_RATE_TYPES.map((rateType) => (
              <option key={rateType} value={rateType}>
                {t(`rateTypes.${rateType}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="debt-term-months"
          label={t('form.termMonths')}
          error={errorFor('termMonths')}
        >
          <Input
            id="debt-term-months"
            name="termMonths"
            type="number"
            min={1}
            step={1}
            required
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="debt-start-date"
          label={t('form.startDate')}
          error={errorFor('startDate')}
        >
          <Input
            id="debt-start-date"
            name="startDate"
            type="date"
            max={todayIso}
            required
          />
        </Field>
        <Field
          id="debt-payment"
          label={t('form.payment')}
          error={errorFor('payment')}
        >
          <Input
            id="debt-payment"
            name="payment"
            inputMode="decimal"
            required
          />
        </Field>
      </div>

      <Field id="debt-notes" label={t('form.notes')}>
        <Input id="debt-notes" name="notes" maxLength={500} />
      </Field>

      {formError ? <p className="text-neg text-sm">{formError}</p> : null}

      <Button type="submit" disabled={pending}>
        {t('form.submit')}
      </Button>
    </form>
  )
}
