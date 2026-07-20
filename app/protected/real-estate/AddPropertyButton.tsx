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
import { createProperty } from './actions'
import { PropertyForm } from './PropertyForm'

/** Header CTA: the add flow lives in a dialog (AddInvestmentButton pattern). */
export function AddPropertyButton({ todayIso }: { todayIso: string }) {
  const t = useTranslations('realEstate')
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
        <PropertyForm
          action={createProperty}
          todayIso={todayIso}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
