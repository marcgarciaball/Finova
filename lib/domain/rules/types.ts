/**
 * Categorization-rule domain types (P3-01).
 *
 * Single source of truth for the rule/clause shape shared by the validator
 * (`lib/validation/categorization-rule.ts`), the import seam
 * (`lib/domain/import/categorize.ts`), and the future matcher (P3-02). Pure
 * types — no logic.
 *
 * A rule's `conditions` is a non-empty array of clauses that are AND-combined:
 * a rule matches a transaction only when *every* clause matches. OR is expressed
 * by authoring two rules (no nested boolean groups — YAGNI for v1).
 */

/** String predicates over a transaction's `description`. */
export type DescriptionOp = 'contains' | 'equals' | 'starts_with' | 'regex'

/** Numeric predicates over a transaction's signed `amount_cents`. */
export type AmountOp = 'lt' | 'lte' | 'gt' | 'gte' | 'eq'

export type Clause =
  | { field: 'description'; op: DescriptionOp; value: string }
  // `absolute: true` compares |amount_cents| (sign-agnostic); default compares
  // the signed value (negative = expense, positive = income).
  | { field: 'amount_cents'; op: AmountOp; value: number; absolute?: boolean }
  | { field: 'account_id'; op: 'eq'; value: string }

/** Non-empty; clauses are AND-combined. */
export type RuleConditions = Clause[]

/** A categorization rule as the matcher (P3-02) and the import seam (P3-03) consume it. */
export interface Rule {
  categoryId: string
  conditions: RuleConditions
  enabled: boolean
  id: string
  /** Lower number = higher priority; created_at breaks ties. Semantic owned by P3-02. */
  priority: number
}
