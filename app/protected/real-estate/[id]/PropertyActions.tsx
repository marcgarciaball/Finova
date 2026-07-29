'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import type { ActionResult } from '../actions'
import { deleteProperty, sellProperty, updateProperty } from '../actions'
import { PropertyForm, type PropertyFormInitial } from '../PropertyForm'
import { Field } from './FormBits'

/** Header actions on the detail page: edit, mark as sold, delete the property. */
export function PropertyActions({
  propertyId,
  isSold,
  todayIso,
  initial,
}: {
  propertyId: string
  isSold: boolean
  todayIso: string
  initial: PropertyFormInitial
}) {
  const t = useTranslations('realEstate')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex items-center gap-2">
      <EditDialog initial={initial} todayIso={todayIso} />
      {isSold ? null : (
        <SellDialog propertyId={propertyId} todayIso={todayIso} />
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (window.confirm(t('detail.confirmDeleteProperty'))) {
            startTransition(async () => {
              const result = await deleteProperty(propertyId)
              if (result.ok) {
                router.push('/protected/real-estate')
              }
            })
          }
        }}
      >
        <Trash2 className="size-4" aria-hidden="true" />
        {t('detail.delete')}
      </Button>
    </div>
  )
}

function EditDialog({
  initial,
  todayIso,
}: {
  initial: PropertyFormInitial
  todayIso: string
}) {
  const t = useTranslations('realEstate')
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Pencil className="size-4" aria-hidden="true" />
          {t('detail.editProperty')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('detail.editProperty')}</DialogTitle>
        </DialogHeader>
        <PropertyForm
          action={updateProperty}
          todayIso={todayIso}
          mode="edit"
          initial={initial}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function SellDialog({
  propertyId,
  todayIso,
}: {
  propertyId: string
  todayIso: string
}) {
  const t = useTranslations('realEstate')
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(sellProperty, undefined)

  useEffect(() => {
    if (state?.ok) {
      setOpen(false)
    }
  }, [state])

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined
  const formError =
    state && !state.ok && !fieldErrors ? t('errors.unexpected') : undefined

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          {t('detail.sell')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('detail.sell')}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={propertyId} />
          <Field
            id="sell-date"
            label={t('sellForm.soldDate')}
            error={fieldErrors?.soldDate ? t('errors.invalidDate') : undefined}
          >
            <Input
              id="sell-date"
              name="soldDate"
              type="date"
              defaultValue={todayIso}
              max={todayIso}
              required
            />
          </Field>
          <Field
            id="sell-price"
            label={t('sellForm.soldPrice')}
            error={
              fieldErrors?.soldPrice ? t('errors.invalidAmount') : undefined
            }
          >
            <Input
              id="sell-price"
              name="soldPrice"
              inputMode="decimal"
              required
            />
          </Field>
          <Field
            id="sell-fees"
            label={t('sellForm.soldFees')}
            error={
              fieldErrors?.soldFees ? t('errors.invalidAmount') : undefined
            }
          >
            <Input
              id="sell-fees"
              name="soldFees"
              inputMode="decimal"
              placeholder="0"
            />
          </Field>
          {formError ? <p className="text-neg text-sm">{formError}</p> : null}
          <Button type="submit" disabled={pending}>
            {t('sellForm.submit')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
