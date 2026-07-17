'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { CURRENCIES } from '@/lib/domain/money/currencies'
import { type ActionResult, updateProfile } from './actions'

const SELECT_CLASS =
  'h-11 w-full rounded-2xl border border-glass-line bg-glass px-4 py-2 text-ink text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

/** Currency preferences form (P5-01). Language/theme live alongside, reused. */
export function ProfileForm({
  baseCurrency,
  displayCurrency,
}: {
  baseCurrency: string
  displayCurrency: string
}) {
  const t = useTranslations('settings.profile')
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(updateProfile, undefined)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (state?.ok) {
      setSaved(true)
      const id = setTimeout(() => setSaved(false), 2500)
      return () => clearTimeout(id)
    }
  }, [state])

  const err = state && !state.ok ? state.error : undefined

  // A base/display currency already on the profile might sit outside the curated
  // list — keep it selectable so saving doesn't silently change it.
  const options = ensureIncluded(
    ensureIncluded(CURRENCIES, baseCurrency),
    displayCurrency
  )

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="base-currency">{t('baseCurrency')}</Label>
        <select
          id="base-currency"
          name="baseCurrency"
          defaultValue={baseCurrency}
          className={SELECT_CLASS}
        >
          {options.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
        <p className="text-ink-soft text-xs">{t('baseCurrencyNote')}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="display-currency">{t('displayCurrency')}</Label>
        <select
          id="display-currency"
          name="displayCurrency"
          defaultValue={displayCurrency}
          className={SELECT_CLASS}
        >
          {options.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
        <p className="text-ink-soft text-xs">{t('displayCurrencyNote')}</p>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {t('save')}
        </Button>
        {saved ? <span className="text-pos text-sm">{t('saved')}</span> : null}
        {err ? <span className="text-neg text-sm">{t('error')}</span> : null}
      </div>
    </form>
  )
}

/** Prepend `code` to the option list if the curated set doesn't already have it. */
function ensureIncluded(
  list: readonly { code: string; name: string }[],
  code: string
): { code: string; name: string }[] {
  if (list.some((c) => c.code === code)) {
    return [...list]
  }
  return [{ code, name: code }, ...list]
}
