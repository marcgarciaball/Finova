'use client'

import { Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import type { ActionResult } from '../actions'

/** Icon-only delete with a native confirm — table row affordance. */
export function DeleteRowButton({
  action,
  id,
}: {
  action: (id: string) => Promise<ActionResult>
  id: string
}) {
  const t = useTranslations('manualAssets.detail')
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      aria-label={t('delete')}
      disabled={pending}
      className="text-ink-soft transition-colors hover:text-neg disabled:opacity-50"
      onClick={() => {
        if (window.confirm(t('confirmDelete'))) {
          startTransition(async () => {
            await action(id)
          })
        }
      }}
    >
      <Trash2 className="size-4" aria-hidden="true" />
    </button>
  )
}
