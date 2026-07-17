import type {
  AmountOp,
  Clause,
  DescriptionOp,
  RuleConditions,
} from '@/lib/domain/rules/types'
import { parseAmountToCents } from '@/lib/validation/transaction'

/**
 * Pure form-state ↔ `RuleConditions` mapping for the rule editor (P5-01).
 *
 * The `ClauseBuilder` UI holds an array of `ClauseDraft`s (all values as
 * strings, as an HTML form does); this module converts them to the validated
 * domain `Clause` shape and back for editing. No I/O, no React — unit-testable,
 * mirroring the import `mapping-form` helper.
 *
 * Amounts are entered in major units and converted to signed integer cents via
 * the money module (never floated). Rules compare raw cents regardless of a
 * transaction's currency, so a fixed 2-decimal basis (`EUR`) is used purely as
 * the major→minor scale — it is not a currency assumption about the data.
 */
const AMOUNT_SCALE_CURRENCY = 'EUR'

export const DESCRIPTION_OPS: readonly DescriptionOp[] = [
  'contains',
  'equals',
  'starts_with',
  'regex',
]
export const AMOUNT_OPS: readonly AmountOp[] = ['lt', 'lte', 'gt', 'gte', 'eq']

export type ClauseField = Clause['field']

export interface ClauseDraft {
  /** Amount only: compare |amount_cents| when true. */
  absolute: boolean
  field: ClauseField
  op: string
  value: string
}

/** A blank draft for a newly-added clause of the given field. */
export function emptyDraft(field: ClauseField = 'description'): ClauseDraft {
  const op =
    field === 'description'
      ? 'contains'
      : field === 'amount_cents'
        ? 'gt'
        : 'eq'
  return { field, op, value: '', absolute: false }
}

/** Convert an amount entered in major units to signed integer cents. */
function amountToCents(value: string): number {
  const trimmed = value.trim()
  if (trimmed === '' || Number.isNaN(Number(trimmed))) {
    return Number.NaN // fails `conditionsSchema` (int) — surfaced as invalid.
  }
  return parseAmountToCents(trimmed, AMOUNT_SCALE_CURRENCY)
}

/**
 * Map drafts to `RuleConditions`. Best-effort and total: malformed amounts
 * become `NaN` so the downstream `conditionsSchema` rejects them cleanly rather
 * than this throwing. The caller validates the result before persisting.
 */
export function buildConditions(drafts: ClauseDraft[]): RuleConditions {
  return drafts.map((d): Clause => {
    if (d.field === 'amount_cents') {
      return {
        field: 'amount_cents',
        op: (AMOUNT_OPS.includes(d.op as AmountOp) ? d.op : 'eq') as AmountOp,
        value: amountToCents(d.value),
        absolute: d.absolute,
      }
    }
    if (d.field === 'account_id') {
      return { field: 'account_id', op: 'eq', value: d.value.trim() }
    }
    return {
      field: 'description',
      op: (DESCRIPTION_OPS.includes(d.op as DescriptionOp)
        ? d.op
        : 'contains') as DescriptionOp,
      value: d.value,
    }
  })
}

/** Reverse: seed the editor from persisted conditions (edit mode). */
export function draftsFromConditions(
  conditions: RuleConditions
): ClauseDraft[] {
  return conditions.map((c): ClauseDraft => {
    if (c.field === 'amount_cents') {
      return {
        field: 'amount_cents',
        op: c.op,
        value: (c.value / 100).toFixed(2),
        absolute: c.absolute ?? false,
      }
    }
    return { field: c.field, op: c.op, value: c.value, absolute: false }
  })
}
