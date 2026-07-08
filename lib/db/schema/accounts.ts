import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase'

/**
 * accounts (P1-02) — a user's financial accounts (checking, card, cash…).
 *
 * Ownership is `user_id` (= auth.uid()). RLS is default-deny and mirrors the
 * `profiles` pattern: four owner-scoped policies, `(select auth.uid())` so
 * Postgres caches the value per statement. Rows cascade-delete with the user.
 *
 * `opening_balance` is integer minor units (cents, ADR-007). bigint mode
 * 'number' keeps it a JS number within the money module's safe-integer range;
 * postgres-js would otherwise return bigint as a string and break arithmetic.
 */
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(),
    currency: text('currency').notNull(),
    openingBalance: bigint('opening_balance', { mode: 'number' })
      .notNull()
      .default(0),
    // Nominal annual rate in basis points (e.g. 200 = 2.00%), for accounts
    // that pay interest (typically 'savings'). Null = no rate set. Purely
    // informational — drives a projected/accrued interest display, never
    // posted as a real transaction.
    interestRateBps: integer('interest_rate_bps'),
    archived: boolean('archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'accounts_name_check',
      sql`char_length(trim(${table.name})) between 1 and 100`
    ),
    check(
      'accounts_type_check',
      sql`${table.type} in ('checking', 'savings', 'cash', 'credit_card', 'investment')`
    ),
    check('accounts_currency_check', sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      'accounts_interest_rate_bps_check',
      sql`${table.interestRateBps} is null or ${table.interestRateBps} between 0 and 10000`
    ),
    index('accounts_user_id_idx').on(table.userId),
    pgPolicy('accounts_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('accounts_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('accounts_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('accounts_delete_own', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
  ]
)

export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert
