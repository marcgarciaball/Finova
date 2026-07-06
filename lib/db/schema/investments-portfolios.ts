import { sql } from 'drizzle-orm'
import {
  check,
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase'

/**
 * Inversiones (A1): per-user portfolios and named broker accounts.
 *
 * Multi-portfolio ready from day one; the UI starts with a single default
 * portfolio (created in slice A4, base_currency seeded from profiles).
 * RLS mirrors the cash `accounts` pattern: default-deny, four owner-scoped
 * policies keyed on `(select auth.uid())`.
 */
export const portfolios = pgTable(
  'portfolios',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default('My Portfolio'),
    baseCurrency: text('base_currency').notNull().default('EUR'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'portfolios_base_currency_check',
      sql`${table.baseCurrency} ~ '^[A-Z]{3}$'`
    ),
    index('portfolios_user_id_idx').on(table.userId),
    pgPolicy('portfolios_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('portfolios_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('portfolios_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('portfolios_delete_own', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
  ]
)

/** Named broker/account within a portfolio (e.g. "DEGIRO"). */
export const investmentAccounts = pgTable(
  'investment_accounts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    portfolioId: uuid('portfolio_id')
      .notNull()
      .references(() => portfolios.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    currency: text('currency').notNull().default('EUR'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'investment_accounts_currency_check',
      sql`${table.currency} ~ '^[A-Z]{3}$'`
    ),
    index('investment_accounts_user_id_idx').on(table.userId),
    index('investment_accounts_portfolio_id_idx').on(table.portfolioId),
    pgPolicy('investment_accounts_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('investment_accounts_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('investment_accounts_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('investment_accounts_delete_own', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
  ]
)
