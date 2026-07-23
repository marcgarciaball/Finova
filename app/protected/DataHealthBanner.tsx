'use client'

import { format, money } from '@finova/domain/money'
import { AlertTriangle, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { recategorizeUncategorized } from './transactions/actions'

const DISMISS_KEY = 'finova:dataHealthDismissed'

/**
 * Data-health banner: when a large share of spending is uncategorized, the
 * breakdown and savings rate are misleading, so we surface it with a one-click
 * fix (the existing recategorize action) instead of quietly showing bad data.
 *
 * Dismissal is keyed by the uncategorized amount in localStorage, so it stays
 * dismissed until NEW uncategorized spending appears (a different amount), then
 * the banner returns on its own.
 */
export function DataHealthBanner({
  uncategorizedCents,
  currency,
  locale,
}: {
  uncategorizedCents: number
  currency: string
  locale: string
}) {
  const t = useTranslations('dashboard.banner')
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(true) // assume hidden until checked

  // Read prior dismissal on mount (client-only; avoids SSR/localStorage clash).
  useEffect(() => {
    const stored = window.localStorage.getItem(DISMISS_KEY)
    setDismissed(stored === String(uncategorizedCents))
  }, [uncategorizedCents])

  if (uncategorizedCents <= 0 || dismissed) return null

  const amount = format(money(uncategorizedCents, currency), locale)

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, String(uncategorizedCents))
    setDismissed(true)
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-3xl border border-amber-300/60 bg-amber-50/70 p-4 text-ink dark:bg-amber-950/30">
      <AlertTriangle
        className="size-5 shrink-0 text-cat-amber"
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold text-sm">{t('title', { amount })}</span>
        <span className="text-ink-soft text-xs">{msg ?? t('body')}</span>
      </div>
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => {
          setMsg(null)
          start(async () => {
            const r = await recategorizeUncategorized()
            if (!r.ok) {
              setMsg(t('error'))
            } else if (r.updated === 0) {
              setMsg(t('none'))
            } else {
              setMsg(t('done', { updated: r.updated, scanned: r.scanned }))
              router.refresh()
            }
          })
        }}
      >
        {pending ? t('running') : t('cta')}
      </Button>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('dismiss')}
        className="rounded-full p-1 text-ink-soft hover:text-ink"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
