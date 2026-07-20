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
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase'
import { portfolios } from '@/lib/db/schema/investments-portfolios'
import { assets } from '@/lib/db/schema/investments-reference'

/**
 * Inversiones (A1): derived state — rebuilt from investment_transactions +
 * cached_quotes by the refresh job (A5) via the service-role client. Users
 * get SELECT-own only: there are deliberately NO user write policies, so a
 * crafted client request can never corrupt derived rows.
 */
export const holdings = pgTable(
  'holdings',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    portfolioId: uuid('portfolio_id')
      .notNull()
      .references(() => portfolios.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id),
    quantity: numeric('quantity', { precision: 20, scale: 8 }).notNull(),
    avgCostCents: bigint('avg_cost_cents', { mode: 'number' }).notNull(),
    investedCents: bigint('invested_cents', { mode: 'number' }).notNull(),
    realizedPlCents: bigint('realized_pl_cents', { mode: 'number' })
      .notNull()
      .default(0),
    currentPriceCents: bigint('current_price_cents', { mode: 'number' }),
    currentValueCents: bigint('current_value_cents', { mode: 'number' }),
    unrealizedPlCents: bigint('unrealized_pl_cents', { mode: 'number' }),
    unrealizedPlPct: numeric('unrealized_pl_pct', {
      precision: 10,
      scale: 4,
    }),
    dividendsCents: bigint('dividends_cents', { mode: 'number' })
      .notNull()
      .default(0),
    lastComputedAt: timestamp('last_computed_at', { withTimezone: true }),
  },
  (table) => [
    unique('holdings_portfolio_asset_unique').on(
      table.portfolioId,
      table.assetId
    ),
    index('holdings_user_id_idx').on(table.userId),
    pgPolicy('holdings_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
  ]
)

/** Daily portfolio value snapshots for the evolution chart (written by A5). */
export const portfolioSnapshots = pgTable(
  'portfolio_snapshots',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    portfolioId: uuid('portfolio_id')
      .notNull()
      .references(() => portfolios.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    snapshotDate: date('snapshot_date').notNull(),
    totalValueCents: bigint('total_value_cents', { mode: 'number' }).notNull(),
    baseCurrency: text('base_currency').notNull(),
  },
  (table) => [
    check(
      'portfolio_snapshots_base_currency_check',
      sql`${table.baseCurrency} ~ '^[A-Z]{3}$'`
    ),
    unique('portfolio_snapshots_portfolio_date_unique').on(
      table.portfolioId,
      table.snapshotDate
    ),
    index('portfolio_snapshots_user_id_idx').on(table.userId),
    pgPolicy('portfolio_snapshots_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
  ]
)
