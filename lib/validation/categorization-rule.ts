import type { Rule, RuleConditions } from '@finova/domain/rules/types'
import { z } from 'zod'

/**
 * Categorization-rule validation (P3-01).
 *
 * `conditionsSchema` is the runtime source of truth for the `conditions` jsonb
 * stored on `categorization_rules` — the column trusts nothing, so every write
 * validates against it. It is kept structurally in lockstep with the `Clause`
 * union in `lib/domain/rules/types.ts` (a discriminated union on `field`); the
 * type-level assertion at the bottom fails the build if the two drift.
 *
 * No matching logic here — that is P3-02. This ships only the data contract.
 */

// Each clause is `.strict()` — the conditions jsonb trusts nothing, so an
// unexpected key (a typo or a stale field) is rejected, not silently stripped
// (mirrors the `.strict()` rigor of `import-template.ts`'s jsonb schemas).
const descriptionClauseSchema = z.strictObject({
  field: z.literal('description'),
  op: z.enum(['contains', 'equals', 'starts_with', 'regex']),
  // Length-capped to bound a `regex` op's ReDoS surface cheaply; full
  // safe-execution is a P3-02 matcher concern (matching runs in-process over a
  // user's own rules + own data, so the blast radius is self-limited).
  value: z.string().min(1, 'valueRequired').max(200, 'valueTooLong'),
})

const amountClauseSchema = z.strictObject({
  field: z.literal('amount_cents'),
  op: z.enum(['lt', 'lte', 'gt', 'gte', 'eq']),
  value: z.number().int('valueMustBeInteger'),
  // `true` compares |amount_cents| (sign-agnostic); default compares the signed value.
  absolute: z.boolean().optional(),
})

const accountClauseSchema = z.strictObject({
  field: z.literal('account_id'),
  op: z.literal('eq'),
  value: z.uuid('valueMustBeUuid'),
})

const clauseSchema = z.discriminatedUnion('field', [
  descriptionClauseSchema,
  amountClauseSchema,
  accountClauseSchema,
])

/** Non-empty; clauses are AND-combined. */
export const conditionsSchema = z
  .array(clauseSchema)
  .min(1, 'conditionsRequired')

const nameSchema = z
  .string()
  .trim()
  .min(1, 'nameRequired')
  .max(100, 'nameTooLong')

// Postgres `integer` upper bound — keep the validator and the column in
// agreement so an oversized priority fails as a clean validation error, not an
// opaque "integer out of range" at write time.
const PG_INT_MAX = 2_147_483_647

const prioritySchema = z
  .number()
  .int('priorityMustBeInteger')
  .min(0, 'priorityNegative')
  .max(PG_INT_MAX, 'priorityTooLarge')

export const createCategorizationRuleSchema = z.object({
  name: nameSchema,
  conditions: conditionsSchema,
  categoryId: z.uuid('categoryRequired'),
  priority: prioritySchema.optional().default(0),
  enabled: z.boolean().optional().default(true),
})

export const updateCategorizationRuleSchema = z.object({
  id: z.uuid('idRequired'),
  name: nameSchema.optional(),
  conditions: conditionsSchema.optional(),
  categoryId: z.uuid('categoryRequired').optional(),
  priority: prioritySchema.optional(),
  enabled: z.boolean().optional(),
})

/** The persisted `categorization_rules` row, parsed safely at the data boundary. */
export const categorizationRuleRowSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  name: z.string(),
  // i18n key for seeded defaults (NULL for user-authored rules).
  name_key: z.string().nullable(),
  conditions: conditionsSchema,
  category_id: z.string().min(1),
  priority: z.number().int(),
  enabled: z.boolean(),
  is_default: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type ClauseInput = z.infer<typeof clauseSchema>
export type CreateCategorizationRuleInput = z.infer<
  typeof createCategorizationRuleSchema
>
export type UpdateCategorizationRuleInput = z.infer<
  typeof updateCategorizationRuleSchema
>
export type CategorizationRuleRow = z.infer<typeof categorizationRuleRowSchema>

/**
 * Map a persisted (snake_case) `categorization_rules` row to the camelCase
 * domain `Rule` the matcher consumes. The boundary mapper for the data layer,
 * so reads never hand-map fields. `conditions` is already validated by
 * `categorizationRuleRowSchema`.
 */
export function toDomainRule(row: CategorizationRuleRow): Rule {
  return {
    id: row.id,
    categoryId: row.category_id,
    conditions: row.conditions,
    priority: row.priority,
    enabled: row.enabled,
  }
}

/**
 * Compile-time guard: the schema's inferred conditions type must equal the
 * domain `RuleConditions`. If either side changes shape, this assignment fails
 * to typecheck — the schema and the domain type cannot drift silently.
 */
type _AssertConditionsMatch = [
  z.infer<typeof conditionsSchema> extends RuleConditions ? true : never,
  RuleConditions extends z.infer<typeof conditionsSchema> ? true : never,
]
const _assertConditionsMatch: _AssertConditionsMatch = [true, true]
void _assertConditionsMatch
