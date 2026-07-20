'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { recategorizeUncategorized } from './actions'

/**
 * On-demand "apply rules" control (P3-03). Categorizes the user's uncategorized
 * transactions — useful for manually-added rows and anything imported before a
 * rule existed. Provisions the built-in rules first if the user has none.
 */
export function RecategorizeButton() {
  const t = useTranslations('transactions.recategorize')
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
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
            }
          })
        }}
      >
        {pending ? t('running') : t('button')}
      </Button>
      {msg ? <span className="text-ink-soft text-sm">{msg}</span> : null}
    </div>
  )
}
