import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase'
import { categories } from '@/lib/db/schema/categories'

/**
 * categorization_rules (P3-01) — a user's auto-categorization rules. Each rule
 * targets one category and carries a non-empty array of AND-combined clauses
 * (`conditions` jsonb). P3-02 builds the matcher; P3-03 applies rules at import
 * commit and on demand. P3-01 ships only the data foundation — no matching here.
 *
 * Ownership is `user_id` (= auth.uid()), RLS default-deny mirroring `categories`.
 * `conditions` is jsonb but the column trusts nothing — writes validate against
 * `lib/validation/categorization-rule.ts#conditionsSchema` first.
 *
 * `category_id` is **ON DELETE CASCADE** (deliberately unlike
 * `transactions.category_id`, which is SET NULL): a rule whose target category
 * is gone can never act, so it is removed with the category. A transaction is a
 * record worth preserving uncategorized; a rule is not.
 */
export const categorizationRules = pgTable(
  'categorization_rules',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // i18n key for seeded default rules (NULL for user-authored); mirrors
    // categories.name_key. The UI translates via `rules.defaults.<name_key>`.
    nameKey: text('name_key'),
    conditions: jsonb('conditions').notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    // Lower number = higher priority; created_at breaks ties (semantic in P3-02).
    priority: integer('priority').notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),
    // Flags rows planted by the P3-04 signup seed.
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'categorization_rules_name_check',
      sql`char_length(trim(${table.name})) between 1 and 100`
    ),
    check('categorization_rules_priority_check', sql`${table.priority} >= 0`),
    index('categorization_rules_user_id_idx').on(table.userId),
    // The ordered fetch P3-03 uses to pull a user's active rules in precedence order.
    index('categorization_rules_user_enabled_priority_idx').on(
      table.userId,
      table.enabled,
      table.priority
    ),
    // Keeps default name_keys unique per user and the P3-04 signup seed idempotent.
    uniqueIndex('categorization_rules_user_name_key_uidx')
      .on(table.userId, table.nameKey)
      .where(sql`${table.nameKey} is not null`),
    pgPolicy('categorization_rules_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('categorization_rules_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('categorization_rules_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('categorization_rules_delete_own', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
  ]
)

export type CategorizationRule = typeof categorizationRules.$inferSelect
export type NewCategorizationRule = typeof categorizationRules.$inferInsert
