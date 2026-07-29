import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  date,
  index,
  numeric,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase'
import {
  investmentAccounts,
  portfolios,
} from '@/lib/db/schema/investments-portfolios'
import { assets } from '@/lib/db/schema/investments-reference'

/**
 * Inversiones (A1): the user transaction log — raw user truth, never mutated
 * by price refresh, source for rebuilding `holdings`. Quantity is
 * numeric(20,8) for crypto fractions; money stays integer cents in the
 * transaction currency. `edited_at`/`edit_reason` are the audit trail for
 * manual edits.
 */
export const investmentTransactions = pgTable(
  'investment_transactions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    portfolioId: uuid('portfolio_id')
      .notNull()
      .references(() => portfolios.id),
    accountId: uuid('account_id').references(() => investmentAccounts.id),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id),
    type: text('type').notNull(),
    quantity: numeric('quantity', { precision: 20, scale: 8 }).notNull(),
    priceCents: bigint('price_cents', { mode: 'number' }).notNull(),
    currency: text('currency').notNull(),
    feesCents: bigint('fees_cents', { mode: 'number' }).notNull().default(0),
    tradedAt: date('traded_at').notNull(),
    notes: text('notes'),
    fundingSource: text('funding_source').notNull().default('own_funds'),
    fundingNote: text('funding_note'),
    importFingerprint: text('import_fingerprint'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    editReason: text('edit_reason'),
  },
  (table) => [
    check(
      'investment_transactions_type_check',
      sql`${table.type} in ('buy', 'sell')`
    ),
    uniqueIndex('investment_transactions_user_fingerprint_unique')
      .on(table.userId, table.importFingerprint)
      .where(sql`${table.importFingerprint} is not null`),
    check('investment_transactions_quantity_check', sql`${table.quantity} > 0`),
    check('investment_transactions_price_check', sql`${table.priceCents} >= 0`),
    check('investment_transactions_fees_check', sql`${table.feesCents} >= 0`),
    check(
      'investment_transactions_currency_check',
      sql`${table.currency} ~ '^[A-Z]{3}$'`
    ),
    check(
      'investment_transactions_funding_source_check',
      sql`${table.fundingSource} in ('own_funds', 'credit')`
    ),
    index('investment_transactions_user_id_idx').on(table.userId),
    index('investment_transactions_portfolio_asset_idx').on(
      table.portfolioId,
      table.assetId
    ),
    pgPolicy('investment_transactions_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('investment_transactions_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('investment_transactions_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('investment_transactions_delete_own', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
  ]
)
