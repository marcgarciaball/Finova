'use client'

import { MANUAL_ASSET_TYPES } from '@finova/domain/manual-assets/types'
import { Pencil, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import type { ManualAssetRow } from '@/lib/validation/manual-assets'
import type { ActionResult } from '../actions'
import { deleteManualAsset, updateManualAsset } from '../actions'
import { Field, SELECT_CLASS } from './FormBits'

/** Header actions on the detail page: edit, delete the asset. */
export function AssetActions({ asset }: { asset: ManualAssetRow }) {
  const t = useTranslations('manualAssets')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex items-center gap-2">
      <EditDialog asset={asset} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (window.confirm(t('detail.confirmDeleteAsset'))) {
            startTransition(async () => {
              const result = await deleteManualAsset(asset.id)
              if (result.ok) {
                router.push('/protected/manual-assets')
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

function EditDialog({ asset }: { asset: ManualAssetRow }) {
  const t = useTranslations('manualAssets')
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(updateManualAsset, undefined)

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
          <Pencil className="size-4" aria-hidden="true" />
          {t('detail.edit')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('detail.edit')}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={asset.id} />
          <Field
            id="edit-ma-name"
            label={t('form.name')}
            error={fieldErrors?.name ? t('errors.required') : undefined}
          >
            <Input
              id="edit-ma-name"
              name="name"
              defaultValue={asset.name}
              maxLength={120}
              required
            />
          </Field>
          <Field id="edit-ma-type" label={t('form.type')}>
            <select
              id="edit-ma-type"
              name="type"
              defaultValue={asset.type}
              className={SELECT_CLASS}
            >
              {MANUAL_ASSET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`types.${type}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field id="edit-ma-notes" label={t('form.notes')}>
            <Input
              id="edit-ma-notes"
              name="notes"
              defaultValue={asset.notes ?? ''}
              maxLength={500}
            />
          </Field>
          <div className="flex items-center gap-2">
            <Checkbox
              id="edit-ma-closed"
              name="isClosed"
              defaultChecked={asset.is_closed}
            />
            <label htmlFor="edit-ma-closed" className="text-ink text-sm">
              {t('form.isClosed')}
            </label>
          </div>
          {formError ? <p className="text-neg text-sm">{formError}</p> : null}
          <Button type="submit" disabled={pending}>
            {t('form.update')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
