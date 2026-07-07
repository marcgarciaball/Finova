'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { refreshInvestmentPrices } from './actions'

/** Manual price refresh (the page also auto-refreshes stale quotes on load). */
export function RefreshPricesButton() {
  const t = useTranslations('investments')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  return (
    <div className="flex items-center gap-2">
      {error ? <p className="text-neg text-xs">{error}</p> : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(null)
          start(async () => {
            const res = await refreshInvestmentPrices()
            if (!res.ok) {
              setError(t('errors.unexpected'))
            }
          })
        }}
      >
        {pending ? t('overview.refreshing') : t('overview.refresh')}
      </Button>
    </div>
  )
}
