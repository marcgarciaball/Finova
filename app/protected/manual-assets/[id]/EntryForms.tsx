'use client'

import { MANUAL_VALUATION_SOURCES } from '@finova/domain/manual-assets/types'
import { useTranslations } from 'next-intl'
import { useActionState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { ActionResult } from '../actions'
import { createManualAssetIncome, createManualAssetValuation } from '../actions'
import { AddDialog, Field, SELECT_CLASS } from './FormBits'

const KNOWN_ERROR_KEYS = new Set(['invalidAmount', 'invalidDate', 'required'])

export function AddValuationButton({
  manualAssetId,
  todayIso,
}: {
  manualAssetId: string
  todayIso: string
}) {
  const t = useTranslations('manualAssets')
  return (
    <AddDialog title={t('detail.addValuation')}>
      {(onDone) => (
        <ValuationForm
          manualAssetId={manualAssetId}
          todayIso={todayIso}
          onDone={onDone}
        />
      )}
    </AddDialog>
  )
}

function ValuationForm({
  manualAssetId,
  todayIso,
  onDone,
}: {
  manualAssetId: string
  todayIso: string
  onDone: () => void
}) {
  const t = useTranslations('manualAssets')
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(async (prevState, formData) => {
    const result = await createManualAssetValuation(prevState, formData)
    if (result.ok) {
      onDone()
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
      <input type="hidden" name="manualAssetId" value={manualAssetId} />
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
          {MANUAL_VALUATION_SOURCES.map((source) => (
            <option key={source} value={source}>
              {t(`valuationForm.sources.${source}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field id="valuation-notes" label={t('valuationForm.notes')}>
        <Input id="valuation-notes" name="notes" maxLength={500} />
      </Field>
      {formError ? <p className="text-neg text-sm">{formError}</p> : null}
      <Button type="submit" disabled={pending}>
        {t('valuationForm.submit')}
      </Button>
    </form>
  )
}

export function AddIncomeButton({
  manualAssetId,
  todayIso,
}: {
  manualAssetId: string
  todayIso: string
}) {
  const t = useTranslations('manualAssets')
  return (
    <AddDialog title={t('detail.addIncome')}>
      {(onDone) => (
        <IncomeForm
          manualAssetId={manualAssetId}
          todayIso={todayIso}
          onDone={onDone}
        />
      )}
    </AddDialog>
  )
}

function IncomeForm({
  manualAssetId,
  todayIso,
  onDone,
}: {
  manualAssetId: string
  todayIso: string
  onDone: () => void
}) {
  const t = useTranslations('manualAssets')
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(async (prevState, formData) => {
    const result = await createManualAssetIncome(prevState, formData)
    if (result.ok) {
      onDone()
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
      <input type="hidden" name="manualAssetId" value={manualAssetId} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="income-received-date"
          label={t('incomeForm.receivedDate')}
          error={errorFor('receivedDate')}
        >
          <Input
            id="income-received-date"
            name="receivedDate"
            type="date"
            defaultValue={todayIso}
            max={todayIso}
            required
          />
        </Field>
        <Field
          id="income-amount"
          label={t('incomeForm.amount')}
          error={errorFor('amount')}
        >
          <Input
            id="income-amount"
            name="amount"
            inputMode="decimal"
            required
          />
        </Field>
      </div>
      <Field id="income-notes" label={t('incomeForm.notes')}>
        <Input id="income-notes" name="notes" maxLength={500} />
      </Field>
      {formError ? <p className="text-neg text-sm">{formError}</p> : null}
      <Button type="submit" disabled={pending}>
        {t('incomeForm.submit')}
      </Button>
    </form>
  )
}
