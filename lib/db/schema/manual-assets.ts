import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  date,
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase'

/**
 * Manual Assets: user-tracked holdings with no market feed (bonds, private
 * equity, P2P loans, collectibles, …) — distinct from the shared `assets`
 * reference table (Inversiones), which is priced by a provider job.
 * Valuations are manual snapshots — `manual_assets.current_value_cents`
 * mirrors the latest one for cheap reads, same pattern as Real Estate.
 */
export const manualAssets = pgTable(
  'manual_assets',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(),
    currency: text('currency').notNull().default('EUR'),
    acquisitionDate: date('acquisition_date').notNull(),
    costBasisCents: bigint('cost_basis_cents', { mode: 'number' }).notNull(),
    currentValueCents: bigint('current_value_cents', {
      mode: 'number',
    }).notNull(),
    lastValuedAt: date('last_valued_at').notNull(),
    isClosed: boolean('is_closed').notNull().default(false),
    notes: text('notes'),
    importFingerprint: text('import_fingerprint'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('manual_assets_user_fingerprint_unique')
      .on(table.userId, table.importFingerprint)
      .where(sql`${table.importFingerprint} is not null`),
    check(
      'manual_assets_type_check',
      sql`${table.type} in ('bond', 'private_equity', 'p2p_lending', 'collectible', 'other')`
    ),
    check(
      'manual_assets_currency_check',
      sql`${table.currency} ~ '^[A-Z]{3}$'`
    ),
    check('manual_assets_cost_basis_check', sql`${table.costBasisCents} >= 0`),
    check(
      'manual_assets_current_value_check',
      sql`${table.currentValueCents} >= 0`
    ),
    index('manual_assets_user_id_idx').on(table.userId),
    pgPolicy('manual_assets_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('manual_assets_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('manual_assets_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('manual_assets_delete_own', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
  ]
)

/**
 * Income received on a manual asset — bond coupons, P2P interest,
 * distributions, … Dated point-in-time payments (mirrors `rental_income`,
 * minus the period-range shape since these aren't accrued over a lease).
 */
export const manualAssetIncome = pgTable(
  'manual_asset_income',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    manualAssetId: uuid('manual_asset_id')
      .notNull()
      .references(() => manualAssets.id, { onDelete: 'cascade' }),
    receivedDate: date('received_date').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    notes: text('notes'),
    importFingerprint: text('import_fingerprint'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('manual_asset_income_user_fingerprint_unique')
      .on(table.userId, table.importFingerprint)
      .where(sql`${table.importFingerprint} is not null`),
    check('manual_asset_income_amount_check', sql`${table.amountCents} >= 0`),
    index('manual_asset_income_user_id_idx').on(table.userId),
    index('manual_asset_income_asset_id_idx').on(table.manualAssetId),
    pgPolicy('manual_asset_income_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('manual_asset_income_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('manual_asset_income_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('manual_asset_income_delete_own', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
  ]
)

/**
 * Manual valuation history — one snapshot per asset per date, so value
 * growth can be charted over time (mirrors `property_valuations`).
 */
export const manualAssetValuations = pgTable(
  'manual_asset_valuations',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    manualAssetId: uuid('manual_asset_id')
      .notNull()
      .references(() => manualAssets.id, { onDelete: 'cascade' }),
    valuationDate: date('valuation_date').notNull(),
    valueCents: bigint('value_cents', { mode: 'number' }).notNull(),
    source: text('source').default('manual'),
    notes: text('notes'),
    importFingerprint: text('import_fingerprint'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('manual_asset_valuations_asset_date_unique').on(
      table.manualAssetId,
      table.valuationDate
    ),
    uniqueIndex('manual_asset_valuations_user_fingerprint_unique')
      .on(table.userId, table.importFingerprint)
      .where(sql`${table.importFingerprint} is not null`),
    check(
      'manual_asset_valuations_source_check',
      sql`${table.source} is null or ${table.source} in ('manual', 'other')`
    ),
    check('manual_asset_valuations_value_check', sql`${table.valueCents} >= 0`),
    index('manual_asset_valuations_user_id_idx').on(table.userId),
    index('manual_asset_valuations_asset_id_idx').on(table.manualAssetId),
    pgPolicy('manual_asset_valuations_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('manual_asset_valuations_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('manual_asset_valuations_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('manual_asset_valuations_delete_own', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
  ]
)
