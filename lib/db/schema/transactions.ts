import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase'
import { accounts } from '@/lib/db/schema/accounts'
import { categories } from '@/lib/db/schema/categories'

/**
 * transactions (P1-04) — the core ledger row. Each belongs to one account and,
 * optionally, one category.
 *
 * Ownership is `user_id` (= auth.uid()), with the same four default-deny RLS
 * policies as `accounts`/`categories`. RLS only checks the owner; it cannot
 * cheaply assert that `account_id`/`category_id` are owned by the same user (FK
 * checks bypass RLS), so the app layer validates referenced ownership on write.
 *
 * FK semantics:
 *  - `user_id`     → auth.users  ON DELETE cascade  (row goes with the user)
 *  - `account_id`  → accounts    ON DELETE restrict (an account with txns can't
 *                    be hard-deleted — this is the P1-02 emptiness guard)
 *  - `category_id` → categories  ON DELETE set null (deleting a category
 *                    un-categorizes its txns; financial records survive)
 *
 * Money: `amount_cents` is a **signed** integer in minor units (ADR-007, bigint
 * mode 'number' to stay a JS number in the money module's safe range). The sign
 * is the source of truth for income (+) vs expense (−); the category `kind` is
 * descriptive only. Transfers (`is_transfer`) are excluded from totals (P1-06).
 */
export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    categoryId: uuid('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    currency: text('currency').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    description: text('description').notNull(),
    note: text('note'),
    tags: text('tags').array().notNull().default(sql`'{}'`),
    isTransfer: boolean('is_transfer').notNull().default(false),
    transferGroupId: uuid('transfer_group_id'),
    isRecurring: boolean('is_recurring').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('transactions_amount_nonzero_check', sql`${table.amountCents} <> 0`),
    check('transactions_currency_check', sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      'transactions_description_check',
      sql`char_length(trim(${table.description})) between 1 and 200`
    ),
    check(
      'transactions_note_check',
      sql`${table.note} is null or char_length(${table.note}) <= 2000`
    ),
    // A transfer carries a group token; a non-transfer carries none.
    check(
      'transactions_transfer_group_check',
      sql`${table.isTransfer} = (${table.transferGroupId} is not null)`
    ),
    index('transactions_user_id_idx').on(table.userId),
    index('transactions_account_id_idx').on(table.accountId),
    index('transactions_category_id_idx').on(table.categoryId),
    // The main list query: a user's transactions, newest first.
    index('transactions_user_occurred_idx').on(
      table.userId,
      table.occurredAt.desc()
    ),
    // Pair the two legs of a transfer.
    index('transactions_transfer_group_idx')
      .on(table.transferGroupId)
      .where(sql`${table.transferGroupId} is not null`),
    pgPolicy('transactions_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('transactions_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('transactions_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('transactions_delete_own', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
  ]
)

export type Transaction = typeof transactions.$inferSelect
export type NewTransaction = typeof transactions.$inferInsert
