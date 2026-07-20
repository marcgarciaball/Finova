'use client'

import {
  CATEGORY_KINDS,
  type CategoryKind,
} from '@finova/domain/categories/types'
import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import type { CategoryRow } from '@/lib/validation/category'
import { type ActionResult, createCategory, updateCategory } from './actions'
import { IconColorPicker } from './IconColorPicker'

const SELECT_CLASS =
  'h-11 w-full rounded-2xl border border-glass-line bg-glass px-4 py-2 text-ink text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

export interface ParentOption {
  id: string
  kind: CategoryKind
  label: string
}

/**
 * Create / edit a category (P5-01). On a default category (`name_key != null`)
 * the name is read-only until the user taps "Edit name" — only then is `name`
 * submitted, which the action treats as the default→custom conversion signal.
 */
export function CategoryForm({
  category,
  label,
  presetKind,
  presetParentId,
  parents,
  onDone,
}: {
  category?: CategoryRow
  /** Resolved display label (default → i18n) for an existing category. */
  label?: string
  presetKind?: CategoryKind
  presetParentId?: string
  parents: ParentOption[]
  onDone?: () => void
}) {
  const t = useTranslations('settings.categories')
  const isEdit = Boolean(category)
  const isDefault = Boolean(category?.name_key)
  const action = isEdit ? updateCategory : createCategory
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined)

  const [kind, setKind] = useState<CategoryKind>(
    category?.kind ?? presetKind ?? 'expense'
  )
  const [renaming, setRenaming] = useState(!isDefault)

  useEffect(() => {
    if (state?.ok) {
      onDone?.()
    }
  }, [state, onDone])

  const err = state && !state.ok ? state.error : undefined
  // Parent picker: top-level categories of the same kind, excluding self.
  const parentChoices = parents.filter(
    (p) => p.kind === kind && p.id !== category?.id
  )
  const parentFixed = presetParentId !== undefined

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {isEdit && category ? (
        <input type="hidden" name="id" value={category.id} />
      ) : null}

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category-name">{t('fields.name')}</Label>
        {isEdit && isDefault && !renaming ? (
          <div className="flex items-center gap-3">
            <span className="text-ink text-sm">{label}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRenaming(true)}
            >
              {t('editName')}
            </Button>
          </div>
        ) : (
          <>
            <Input
              id="category-name"
              name="name"
              defaultValue={isDefault ? '' : (category?.name ?? '')}
              placeholder={isDefault ? label : undefined}
              required
              maxLength={100}
            />
            {isDefault ? (
              <p className="text-ink-soft text-xs">{t('renameConvertsNote')}</p>
            ) : null}
          </>
        )}
      </div>

      {/* Kind — immutable on edit (moving kind would strand transactions). */}
      {isEdit ? null : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category-kind">{t('fields.kind')}</Label>
          {presetKind ? (
            <input type="hidden" name="kind" value={presetKind} />
          ) : (
            <select
              id="category-kind"
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as CategoryKind)}
              className={SELECT_CLASS}
            >
              {CATEGORY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`kinds.${k}`)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Parent */}
      {parentFixed ? (
        <input type="hidden" name="parentId" value={presetParentId} />
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category-parent">{t('fields.parent')}</Label>
          <select
            id="category-parent"
            name="parentId"
            defaultValue={category?.parent_id ?? ''}
            className={SELECT_CLASS}
          >
            <option value="">{t('topLevel')}</option>
            {parentChoices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <IconColorPicker
        defaultIconName={category?.icon_name}
        defaultColor={category?.color}
        labels={{ icon: t('fields.icon'), color: t('fields.color') }}
      />

      {err ? <p className="text-neg text-sm">{t('error')}</p> : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {isEdit ? t('save') : t('create')}
        </Button>
        {onDone ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            {t('cancel')}
          </Button>
        ) : null}
      </div>
    </form>
  )
}
