'use client'

import { Plus, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import {
  AMOUNT_OPS,
  type ClauseDraft,
  type ClauseField,
  DESCRIPTION_OPS,
  emptyDraft,
} from '@/lib/domain/rules/clause-form'
import type { AccountRow } from '@/lib/validation/account'

const SELECT_CLASS =
  'h-11 rounded-2xl border border-glass-line bg-glass px-3 py-2 text-ink text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

const FIELDS: readonly ClauseField[] = [
  'description',
  'amount_cents',
  'account_id',
]

/**
 * Multi-clause editor (P5-01). Controlled: the parent owns the `drafts` array
 * (AND-combined). Values are strings here; `buildConditions` converts them to
 * the validated domain shape on submit.
 */
export function ClauseBuilder({
  drafts,
  accounts,
  onChange,
}: {
  drafts: ClauseDraft[]
  accounts: AccountRow[]
  onChange: (next: ClauseDraft[]) => void
}) {
  const t = useTranslations('settings.rules')

  const update = (i: number, patch: Partial<ClauseDraft>) =>
    onChange(drafts.map((d, idx) => (idx === i ? { ...d, ...patch } : d)))
  const remove = (i: number) => onChange(drafts.filter((_, idx) => idx !== i))
  const add = () => onChange([...drafts, emptyDraft('description')])

  const onFieldChange = (i: number, field: ClauseField) =>
    // Reset op/value to the new field's defaults so op stays valid.
    onChange(drafts.map((d, idx) => (idx === i ? emptyDraft(field) : d)))

  return (
    <div className="flex flex-col gap-3">
      {drafts.map((draft, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: drafts are positional
        <div key={i} className="flex flex-col gap-2">
          {i > 0 ? (
            <span className="text-ink-soft text-xs uppercase">{t('and')}</span>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={t('clauseField')}
              value={draft.field}
              onChange={(e) => onFieldChange(i, e.target.value as ClauseField)}
              className={SELECT_CLASS}
            >
              {FIELDS.map((f) => (
                <option key={f} value={f}>
                  {t(`fields.${f}`)}
                </option>
              ))}
            </select>

            {draft.field === 'account_id' ? (
              <span className="text-ink-soft text-sm">{t('ops.eq')}</span>
            ) : (
              <select
                aria-label={t('clauseOp')}
                value={draft.op}
                onChange={(e) => update(i, { op: e.target.value })}
                className={SELECT_CLASS}
              >
                {(draft.field === 'amount_cents'
                  ? AMOUNT_OPS
                  : DESCRIPTION_OPS
                ).map((op) => (
                  <option key={op} value={op}>
                    {t(`ops.${op}`)}
                  </option>
                ))}
              </select>
            )}

            {draft.field === 'account_id' ? (
              <select
                aria-label={t('fields.account_id')}
                value={draft.value}
                onChange={(e) => update(i, { value: e.target.value })}
                className={SELECT_CLASS}
              >
                <option value="">{t('choose')}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                aria-label={t('clauseValue')}
                value={draft.value}
                onChange={(e) => update(i, { value: e.target.value })}
                inputMode={
                  draft.field === 'amount_cents' ? 'decimal' : undefined
                }
                placeholder={
                  draft.field === 'amount_cents'
                    ? '0.00'
                    : t('valuePlaceholder')
                }
                className="w-40"
              />
            )}

            {draft.field === 'amount_cents' ? (
              <span className="flex items-center gap-1.5 text-ink-soft text-xs">
                <Checkbox
                  checked={draft.absolute}
                  onCheckedChange={(v) => update(i, { absolute: v === true })}
                  aria-label={t('absolute')}
                />
                {t('absolute')}
              </span>
            ) : null}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={t('removeClause')}
              onClick={() => remove(i)}
              disabled={drafts.length <= 1}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        </div>
      ))}

      <div>
        <Button type="button" variant="ghost" size="sm" onClick={add}>
          <Plus aria-hidden="true" />
          {t('addClause')}
        </Button>
      </div>
    </div>
  )
}
