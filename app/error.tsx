'use client'

import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { GlassCard } from '@/components/ui/GlassCard'

/** App Router error boundary (P5-05) — reports to /api/log-error, then shows a retry. */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('errorBoundary')

  useEffect(() => {
    fetch('/api/log-error', {
      body: JSON.stringify({
        digest: error.digest,
        message: error.message,
        path: window.location.pathname,
        stack: error.stack,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }).catch(() => {
      // Already visible in the browser console via the thrown error itself.
    })
  }, [error])

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <GlassCard className="flex flex-col items-center gap-3">
        <h1 className="font-bold text-ink text-xl">{t('title')}</h1>
        <p className="text-ink-soft text-sm">{t('body')}</p>
        <Button onClick={reset}>{t('retry')}</Button>
      </GlassCard>
    </main>
  )
}
