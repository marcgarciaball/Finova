import { sql } from 'drizzle-orm'
import {
  index,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase'

/**
 * import_templates (P2-03) — a saved column-mapping for one bank's CSV layout.
 *
 * Keyed by `header_signature` (the order-sensitive FNV-1a of the file's headers,
 * from `lib/domain/import/mapping.ts#headerSignature`), so the same bank's next
 * export auto-maps. One template per layout per user: the unique
 * `(user_id, header_signature)` lets save be an upsert on conflict.
 *
 * Ownership is `user_id` (= auth.uid()), RLS default-deny mirroring `accounts`.
 * `mapping` is jsonb but the column trusts nothing — Server Actions validate it
 * with `lib/validation/import-template.ts#columnMappingSchema` before write.
 */
export const importTemplates = pgTable(
  'import_templates',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    headerSignature: text('header_signature').notNull(),
    name: text('name').notNull(),
    mapping: jsonb('mapping').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('import_templates_user_id_idx').on(table.userId),
    uniqueIndex('import_templates_user_signature_key').on(
      table.userId,
      table.headerSignature
    ),
    pgPolicy('import_templates_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('import_templates_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('import_templates_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('import_templates_delete_own', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
  ]
)

export type ImportTemplate = typeof importTemplates.$inferSelect
export type NewImportTemplate = typeof importTemplates.$inferInsert
