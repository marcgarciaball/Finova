import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  index,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase'
import { accounts } from '@/lib/db/schema/accounts'

/**
 * import_batches (P2-01) — one row per uploaded statement, the source of truth
 * for an import's lifecycle across the multi-step pipeline (upload → map →
 * review → commit). The raw file lives in the private `imports` storage bucket
 * at `storage_path`; this row records where it is and how far it has progressed.
 *
 * The **full lifecycle column set is created now** as a deliberate
 * forward-provision: P2-01 only ever writes `status: 'uploaded'`, but P2-07
 * (mapping/review) and P2-08 (commit) then need no further migration. `mapping`
 * and `counts` stay null until P2-07.
 *
 * Ownership is `user_id` (= auth.uid()). RLS is default-deny and mirrors
 * `accounts`: four owner-scoped policies with `(select auth.uid())`. The bucket
 * and its `storage.objects` RLS policies are hand-added to the migration —
 * Drizzle does not model `storage.objects`. `account_id` is chosen at commit,
 * not upload, so it is nullable and set-null on account deletion (the batch and
 * its file outlive the account).
 */
export const importBatches = pgTable(
  'import_batches',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    storagePath: text('storage_path').notNull().unique(),
    filename: text('filename'),
    mimeType: text('mime_type'),
    byteSize: bigint('byte_size', { mode: 'number' }),
    status: text('status').notNull().default('uploaded'),
    mapping: jsonb('mapping'),
    counts: jsonb('counts'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'import_batches_status_check',
      sql`${table.status} in ('uploaded', 'mapped', 'reviewed', 'committed', 'failed')`
    ),
    index('import_batches_user_id_idx').on(table.userId),
    index('import_batches_user_created_idx').on(
      table.userId,
      table.createdAt.desc()
    ),
    pgPolicy('import_batches_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('import_batches_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('import_batches_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('import_batches_delete_own', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
  ]
)

export type ImportBatch = typeof importBatches.$inferSelect
export type NewImportBatch = typeof importBatches.$inferInsert
