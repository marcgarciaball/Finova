import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase'

/**
 * categories (P1-03) — a user's two-level category tree for classifying
 * transactions. Top-level rows have `parent_id = null`; subcategories point at
 * their parent (one level only — enforced in the app layer).
 *
 * Ownership is `user_id` (= auth.uid()), with the same four default-deny RLS
 * policies as `accounts`/`profiles`. `parent_id` self-references and cascades,
 * so deleting a parent removes its subcategories.
 *
 * Naming: `name` is the literal label (user-typed, or an English fallback for
 * seeded rows); `name_key` is the stable i18n key for default rows (NULL for
 * custom ones). The UI translates via `categories.defaults.<name_key>` when set.
 */
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references(
      (): import('drizzle-orm/pg-core').AnyPgColumn => categories.id,
      {
        onDelete: 'cascade',
      }
    ),
    name: text('name').notNull(),
    nameKey: text('name_key'),
    kind: text('kind').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    // Lucide icon name (e.g. 'Home') + a `--cat-*` CSS-var reference. Both
    // null for custom categories until a picker exists; defaults are seeded
    // with these set — see `lib/domain/categories/icons.ts`.
    iconName: text('icon_name'),
    color: text('color'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'categories_name_check',
      sql`char_length(trim(${table.name})) between 1 and 100`
    ),
    check('categories_kind_check', sql`${table.kind} in ('income', 'expense')`),
    index('categories_user_id_idx').on(table.userId),
    index('categories_parent_id_idx').on(table.parentId),
    // Keeps default keys unique per user and the signup seed idempotent.
    uniqueIndex('categories_user_name_key_uidx')
      .on(table.userId, table.nameKey)
      .where(sql`${table.nameKey} is not null`),
    pgPolicy('categories_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('categories_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('categories_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('categories_delete_own', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
  ]
)

export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert
