'use client'

import { categoryLabel } from '@finova/domain/categories/label'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { GlassCard } from '@/components/ui/GlassCard'
import type { AccountRow } from '@/lib/validation/account'
import type { CategorizationRuleRow } from '@/lib/validation/categorization-rule'
import type { CategoryRow } from '@/lib/validation/category'
import { deleteRule, toggleRule } from './actions'
import { RuleForm, type RuleFormInitial } from './RuleForm'

/** Interactive rule management (P5-01). */
export function RuleManager({
  rules,
  categories,
  accounts,
  initialDraft,
}: {
  rules: CategorizationRuleRow[]
  categories: CategoryRow[]
  accounts: AccountRow[]
  /** A prefilled draft from "make this a rule" — opens the create form. */
  initialDraft?: RuleFormInitial
}) {
  const t = useTranslations('settings.rules')
  const tDefaults = useTranslations('categories.defaults')
  const tRuleDefaults = useTranslations('rules.defaults')
  const [creating, setCreating] = useState(Boolean(initialDraft))
  const [editingId, setEditingId] = useState<string | null>(null)

  const categoryById = new Map(categories.map((c) => [c.id, c] as const))
  const ruleName = (r: CategorizationRuleRow): string =>
    r.name_key ? tRuleDefaults(r.name_key) : r.name
  const targetLabel = (r: CategorizationRuleRow): string => {
    const c = categoryById.get(r.category_id)
    return c ? categoryLabel(c, tDefaults) : '—'
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-ink-soft text-sm">{t('intro')}</p>
        <Button type="button" size="sm" onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" />
          {t('newRule')}
        </Button>
      </div>

      {creating ? (
        <GlassCard>
          <RuleForm
            categories={categories}
            accounts={accounts}
            initial={initialDraft}
            onDone={() => setCreating(false)}
          />
        </GlassCard>
      ) : null}

      <div className="flex flex-col gap-3">
        {rules.length === 0 ? (
          <p className="text-ink-soft text-sm">{t('empty')}</p>
        ) : null}
        {rules.map((rule) => (
          <GlassCard key={rule.id} className="flex flex-col gap-3">
            <RuleRow
              rule={rule}
              name={ruleName(rule)}
              target={targetLabel(rule)}
              onEdit={() =>
                setEditingId((id) => (id === rule.id ? null : rule.id))
              }
            />
            {editingId === rule.id ? (
              <RuleForm
                rule={rule}
                label={ruleName(rule)}
                categories={categories}
                accounts={accounts}
                onDone={() => setEditingId(null)}
              />
            ) : null}
          </GlassCard>
        ))}
      </div>
    </div>
  )
}

function RuleRow({
  rule,
  name,
  target,
  onEdit,
}: {
  rule: CategorizationRuleRow
  name: string
  target: string
  onEdit: () => void
}) {
  const t = useTranslations('settings.rules')
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  const onToggle = (enabled: boolean) =>
    startTransition(async () => {
      await toggleRule(rule.id, enabled)
    })
  const onDelete = () =>
    startTransition(async () => {
      await deleteRule(rule.id)
      setConfirming(false)
    })

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Checkbox
          checked={rule.enabled}
          disabled={pending}
          onCheckedChange={(v) => onToggle(v === true)}
          aria-label={t('enabled')}
        />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-ink text-sm">{name}</span>
          <span className="truncate text-ink-soft text-xs">
            {t('summary', { target, priority: rule.priority })}
          </span>
        </div>
      </div>

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
