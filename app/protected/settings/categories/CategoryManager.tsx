'use client'

import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { CategoryIcon } from '@/components/dashboard/CategoryIcon'
import { Button } from '@/components/ui/Button'
import { GlassCard } from '@/components/ui/GlassCard'
import { categoryLabel } from '@/lib/domain/categories/label'
import { buildCategoryTree } from '@/lib/domain/categories/tree'
import type { CategoryRow } from '@/lib/validation/category'
import { deleteCategory } from './actions'
import { CategoryForm, type ParentOption } from './CategoryForm'

type EditState =
  | { mode: 'none' }
  | { mode: 'new-top' }
  | { mode: 'new-sub'; parentId: string }
  | { mode: 'edit'; id: string }

/** Interactive category tree management (P5-01). */
export function CategoryManager({ rows }: { rows: CategoryRow[] }) {
  const t = useTranslations('settings.categories')
  const tDefaults = useTranslations('categories.defaults')
  const [edit, setEdit] = useState<EditState>({ mode: 'none' })

  const labelOf = (row: CategoryRow): string => categoryLabel(row, tDefaults)
  const tree = buildCategoryTree(rows, labelOf)
  const parents: ParentOption[] = tree.map((p) => ({
    id: p.id,
    kind: p.kind,
    label: labelOf(p),
  }))
  const close = () => setEdit({ mode: 'none' })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-ink-soft text-sm">{t('intro')}</p>
        <Button
          type="button"
          size="sm"
          onClick={() => setEdit({ mode: 'new-top' })}
        >
          <Plus aria-hidden="true" />
          {t('newCategory')}
        </Button>
      </div>

      {edit.mode === 'new-top' ? (
        <GlassCard>
          <CategoryForm parents={parents} onDone={close} />
        </GlassCard>
      ) : null}

      <div className="flex flex-col gap-3">
        {tree.map((parent) => (
          <GlassCard key={parent.id} className="flex flex-col gap-3">
            <Row
              row={parent}
              label={labelOf(parent)}
              onEdit={() => setEdit({ mode: 'edit', id: parent.id })}
              onAddSub={() => setEdit({ mode: 'new-sub', parentId: parent.id })}
            />

            {edit.mode === 'edit' && edit.id === parent.id ? (
              <CategoryForm
                category={parent}
                label={labelOf(parent)}
                parents={parents}
                onDone={close}
              />
            ) : null}

            {parent.children.length > 0 ? (
              <ul className="flex flex-col gap-2 border-glass-line border-l pl-4">
                {parent.children.map((child) => (
                  <li key={child.id} className="flex flex-col gap-2">
                    <Row
                      row={child}
                      label={labelOf(child)}
                      onEdit={() => setEdit({ mode: 'edit', id: child.id })}
                    />
                    {edit.mode === 'edit' && edit.id === child.id ? (
                      <CategoryForm
                        category={child}
                        label={labelOf(child)}
                        parents={parents}
                        onDone={close}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {edit.mode === 'new-sub' && edit.parentId === parent.id ? (
              <CategoryForm
                presetKind={parent.kind}
                presetParentId={parent.id}
                parents={parents}
                onDone={close}
              />
            ) : null}
          </GlassCard>
        ))}
      </div>
    </div>
  )
}

/** A single category line: icon + label + actions (+ two-step delete confirm). */
function Row({
  row,
  label,
  onEdit,
  onAddSub,
}: {
  row: CategoryRow
  label: string
  onEdit: () => void
  onAddSub?: () => void
}) {
  const t = useTranslations('settings.categories')
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  const onDelete = () =>
    startTransition(async () => {
      await deleteCategory(row.id)
      setConfirming(false)
    })

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2">
        <CategoryIcon iconName={row.icon_name} color={row.color} />
        <span className="truncate text-ink text-sm">{label}</span>
      </span>

      {confirming ? (
        <span className="flex items-center gap-2">
          <span className="text-ink-soft text-xs">{t('deleteConfirm')}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={pending}
          >
            {t('deleteYes')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(false)}
          >
            {t('cancel')}
          </Button>
        </span>
      ) : (
        <span className="flex items-center gap-1">
          {onAddSub ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={t('addSub')}
              onClick={onAddSub}
            >
              <Plus aria-hidden="true" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t('edit')}
            onClick={onEdit}
          >
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t('delete')}
            onClick={() => setConfirming(true)}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </span>
      )}
    </div>
  )
}
