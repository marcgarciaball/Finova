'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { bulkDeleteTransactions } from './actions'
import { useSelection } from './SelectionContext'

export function BulkDeleteBar() {
  const t = useTranslations('transactions')
  const {
    state,
    count,
    totalFiltered,
    filters,
    clear,
    selectAllMatchingFilter,
  } = useSelection()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (state.mode === 'none' || count === 0) {
    return null
  }

  const canExpandToFilter = state.mode === 'ids' && totalFiltered > count

  function handleConfirm() {
    if (state.mode === 'none') {
      return
    }
    const input =
      state.mode === 'ids'
        ? { mode: 'ids' as const, ids: Array.from(state.ids) }
        : {
            mode: 'filtered' as const,
            filters,
            excludeIds: Array.from(state.excludedIds),
          }
    setError(null)
    startTransition(async () => {
      const result = await bulkDeleteTransactions(input)
      if (!result.ok) {
        setError(t('errors.unexpected'))
        return
      }
      setConfirmOpen(false)
      clear()
    })
  }

  return (
    <>
      <div className="sticky bottom-4 z-40 flex items-center justify-between gap-4 rounded-2xl border bg-popover px-4 py-3 text-popover-foreground shadow-lg">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>{t('selection.count', { count })}</span>
          {canExpandToFilter ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={selectAllMatchingFilter}
            >
              {t('selection.selectAllFiltered', { count: totalFiltered })}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            {t('selection.clear')}
          </Button>
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() => setConfirmOpen(true)}
        >
          {t('selection.deleteButton')}
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('selection.confirmTitle', { count })}</DialogTitle>
            <DialogDescription>{t('selection.confirmBody')}</DialogDescription>
          </DialogHeader>
          {error ? <p className="text-neg text-sm">{error}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setConfirmOpen(false)}
            >
              {t('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={handleConfirm}
            >
              {t('selection.deleteButton')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
