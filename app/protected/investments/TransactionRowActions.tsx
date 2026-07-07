'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/Dialog'
import type { ResolvedAsset } from '@/lib/investments/asset-option'
import {
  deleteInvestmentTransaction,
  editInvestmentTransaction,
} from './actions'
import {
  InvestmentTransactionForm,
  type TxnDefaults,
} from './InvestmentTransactionForm'

/** Edit (dialog) + delete for one row of the investment transaction log. */
export function TransactionRowActions({
  asset,
  todayIso,
  txn,
}: {
  asset: ResolvedAsset
  todayIso: string
  txn: TxnDefaults
}) {
  const t = useTranslations('investments')
  const [error, setError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  function onDelete() {
    if (!window.confirm(t('list.confirmDelete'))) {
      return
    }
    setError(null)
    startDelete(async () => {
      const res = await deleteInvestmentTransaction(txn.id)
      if (!res.ok) {
        setError(
          res.error === 'wouldOversell'
            ? t('errors.wouldOversell')
            : t('errors.unexpected')
        )
      }
    })
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Dialog>
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="sm">
            {t('list.edit')}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {asset.ticker} · {asset.name}
            </DialogTitle>
          </DialogHeader>
          <InvestmentTransactionForm
            action={editInvestmentTransaction}
            asset={asset}
            todayIso={todayIso}
            txn={txn}
          />
        </DialogContent>
      </Dialog>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onDelete}
        disabled={deleting}
      >
        {t('list.delete')}
      </Button>
      {error ? <p className="text-neg text-xs">{error}</p> : null}
    </div>
  )
}
