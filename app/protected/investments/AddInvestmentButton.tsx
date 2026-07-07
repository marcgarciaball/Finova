'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/Dialog'
import { AddTransactionPanel } from './AddTransactionPanel'
import { addInvestmentTransaction, resolveAsset, searchAssets } from './actions'

/** Header CTA: the add flow lives in a dialog, reachable from every tab. */
export function AddInvestmentButton({ todayIso }: { todayIso: string }) {
  const t = useTranslations('investments')

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button">
          <Plus className="size-4" aria-hidden="true" />
          {t('addTitle')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('addTitle')}</DialogTitle>
        </DialogHeader>
        <AddTransactionPanel
          addAction={addInvestmentTransaction}
          resolveAction={resolveAsset}
          searchAction={searchAssets}
          todayIso={todayIso}
        />
      </DialogContent>
    </Dialog>
  )
}
