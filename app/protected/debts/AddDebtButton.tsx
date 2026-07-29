'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/Dialog'
import { DebtForm } from './DebtForm'

/** Header CTA: the add flow lives in a dialog (AddAssetButton pattern). */
export function AddDebtButton({
  properties,
  todayIso,
}: {
  properties: { id: string; name: string }[]
  todayIso: string
}) {
  const t = useTranslations('debts')
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
        <DebtForm
          properties={properties}
          todayIso={todayIso}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
