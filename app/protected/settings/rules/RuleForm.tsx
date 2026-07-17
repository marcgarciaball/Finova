'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { categoryLabel } from '@/lib/domain/categories/label'
import {
  buildConditions,
  type ClauseDraft,
  draftsFromConditions,
  emptyDraft,
} from '@/lib/domain/rules/clause-form'
import type { RuleConditions } from '@/lib/domain/rules/types'
import type { AccountRow } from '@/lib/validation/account'
import type { CategorizationRuleRow } from '@/lib/validation/categorization-rule'
import type { CategoryRow } from '@/lib/validation/category'
import { type ActionResult, createRule, updateRule } from './actions'
import { ClauseBuilder } from './ClauseBuilder'
import { RulePreview } from './RulePreview'

const SELECT_CLASS =
  'h-11 w-full rounded-2xl border border-glass-line bg-glass px-4 py-2 text-ink text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

export interface RuleFormInitial {
  categoryId?: string
  conditions?: RuleConditions
  name?: string
}

/** Create / edit a categorization rule (P5-01), with live preview. */
export function RuleForm({
  rule,
  label,
  categories,
  accounts,
  initial,
  onDone,
}: {
  rule?: CategorizationRuleRow
  /** Resolved rule name (default → i18n) for an existing rule. */
  label?: string
  categories: CategoryRow[]
  accounts: AccountRow[]
  initial?: RuleFormInitial
  onDone?: () => void
}) {
  const t = useTranslations('settings.rules')
  const tDefaults = useTranslations('categories.defaults')
  const isEdit = Boolean(rule)
  const isDefault = Boolean(rule?.name_key)
  const action = isEdit ? updateRule : createRule
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined)

  const [drafts, setDrafts] = useState<ClauseDraft[]>(() =>
    rule
      ? draftsFromConditions(rule.conditions)
      : initial?.conditions
        ? draftsFromConditions(initial.conditions)
        : [emptyDraft('description')]
  )
  const [renaming, setRenaming] = useState(!isDefault)

  useEffect(() => {
    if (state?.ok) {
      onDone?.()
    }
  }, [state, onDone])

  const err = state && !state.ok ? state.error : undefined
  const conditionsJson = JSON.stringify(buildConditions(drafts))
  const defaultCategoryId = rule?.category_id ?? initial?.categoryId ?? ''
  const defaultPriority = rule?.priority ?? 0
  const defaultName = initial?.name ?? ''

  const labelFor = (c: CategoryRow): string => categoryLabel(c, tDefaults)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {isEdit && rule ? (
        <input type="hidden" name="id" value={rule.id} />
      ) : null}
      <input type="hidden" name="conditions" value={conditionsJson} />

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rule-name">{t('fields.name')}</Label>
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
              id="rule-name"
              name="name"
              defaultValue={isDefault ? '' : (rule?.name ?? defaultName)}
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

      {/* Target category */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rule-category">{t('fields.category')}</Label>
        <select
          id="rule-category"
          name="categoryId"
          defaultValue={defaultCategoryId}
          required
          className={SELECT_CLASS}
        >
          <option value="" disabled>
            {t('choose')}
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {labelFor(c)}
            </option>
          ))}
        </select>
      </div>

      {/* Priority */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rule-priority">{t('fields.priority')}</Label>
        <Input
          id="rule-priority"
          name="priority"
          type="number"
          min={0}
          defaultValue={defaultPriority}
          className="w-32"
        />
        <p className="text-ink-soft text-xs">{t('priorityNote')}</p>
      </div>

      {/* Conditions */}
      <div className="flex flex-col gap-2">
        <Label>{t('conditions')}</Label>
        <ClauseBuilder
          drafts={drafts}
          accounts={accounts}
          onChange={setDrafts}
        />
      </div>

      <RulePreview drafts={drafts} />

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
