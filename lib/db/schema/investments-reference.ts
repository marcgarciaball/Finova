import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  date,
  jsonb,
  numeric,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { authenticatedRole } from 'drizzle-orm/supabase'

/**
 * Inversiones (A1): shared market-reference data. No `user_id` — one row per
 * asset/quote/rate serves every user. RLS: authenticated users may SELECT;
 * there are deliberately NO write policies — every write goes through the
 * service-role client (`lib/supabase/admin.ts`), including the asset upsert
 * a validated server action performs during symbol search (A4).
 */

/** Normalized asset identity: (ticker, exchange) for listed, coingecko_id for crypto, ISIN for funds. */
export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    type: text('type').notNull(),
    ticker: text('ticker'),
    isin: text('isin'),
    coingeckoId: text('coingecko_id'),
    exchange: text('exchange'),
    name: text('name').notNull(),
    currency: text('currency').notNull(),
    providerMeta: jsonb('provider_meta').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'assets_type_check',
      sql`${table.type} in ('stock', 'etf', 'fund', 'crypto')`
    ),
    check('assets_currency_check', sql`${table.currency} ~ '^[A-Z]{3}$'`),
    unique('assets_ticker_exchange_unique').on(table.ticker, table.exchange),
    unique('assets_isin_unique').on(table.isin),
    unique('assets_coingecko_id_unique').on(table.coingeckoId),
    pgPolicy('assets_select_authenticated', {
      for: 'select',
      to: authenticatedRole,
      using: sql`true`,
    }),
  ]
)

/** One cached quote per asset, refreshed by the A5 job. */
export const cachedQuotes = pgTable(
  'cached_quotes',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    assetId: uuid('asset_id')
      .notNull()
      .unique()
      .references(() => assets.id, { onDelete: 'cascade' }),
    priceCents: bigint('price_cents', { mode: 'number' }).notNull(),
    currency: text('currency').notNull(),
    quoteType: text('quote_type').notNull(),
    stale: boolean('stale').notNull().default(false),
    provider: text('provider').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'cached_quotes_quote_type_check',
      sql`${table.quoteType} in ('live', 'delayed', 'eod', 'nav', 'stale')`
    ),
    check(
      'cached_quotes_currency_check',
      sql`${table.currency} ~ '^[A-Z]{3}$'`
    ),
    pgPolicy('cached_quotes_select_authenticated', {
      for: 'select',
      to: authenticatedRole,
      using: sql`true`,
    }),
  ]
)

/** Daily OHLC series per asset (populated from Phase C/D onward). */
export const historicalPrices = pgTable(
  'historical_prices',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    openCents: bigint('open_cents', { mode: 'number' }),
    highCents: bigint('high_cents', { mode: 'number' }),
    lowCents: bigint('low_cents', { mode: 'number' }),
    closeCents: bigint('close_cents', { mode: 'number' }).notNull(),
    volume: bigint('volume', { mode: 'number' }),
    currency: text('currency').notNull(),
  },
  (table) => [
    check(
      'historical_prices_currency_check',
      sql`${table.currency} ~ '^[A-Z]{3}$'`
    ),
    unique('historical_prices_asset_date_unique').on(table.assetId, table.date),
    pgPolicy('historical_prices_select_authenticated', {
      for: 'select',
      to: authenticatedRole,
      using: sql`true`,
    }),
  ]
)

/** Dividend events per asset (populated in Phase C). */
export const dividendEvents = pgTable(
  'dividend_events',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    exDate: date('ex_date').notNull(),
    payDate: date('pay_date'),
    amountPerShare: numeric('amount_per_share', {
      precision: 12,
      scale: 6,
    }).notNull(),
    currency: text('currency').notNull(),
    provider: text('provider').notNull(),
  },
  (table) => [
    check(
      'dividend_events_currency_check',
      sql`${table.currency} ~ '^[A-Z]{3}$'`
    ),
    unique('dividend_events_asset_ex_date_unique').on(
      table.assetId,
      table.exDate
    ),
    pgPolicy('dividend_events_select_authenticated', {
      for: 'select',
      to: authenticatedRole,
      using: sql`true`,
    }),
  ]
)

/** Daily FX rates (Frankfurter/ECB), refreshed by the daily job. */
export const fxRates = pgTable(
  'fx_rates',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    fromCcy: text('from_ccy').notNull(),
    toCcy: text('to_ccy').notNull(),
    rate: numeric('rate', { precision: 18, scale: 8 }).notNull(),
    rateDate: date('rate_date').notNull(),
  },
  (table) => [
    check('fx_rates_from_ccy_check', sql`${table.fromCcy} ~ '^[A-Z]{3}$'`),
    check('fx_rates_to_ccy_check', sql`${table.toCcy} ~ '^[A-Z]{3}$'`),
    check('fx_rates_rate_check', sql`${table.rate} > 0`),
    unique('fx_rates_pair_date_unique').on(
      table.fromCcy,
      table.toCcy,
      table.rateDate
    ),
    pgPolicy('fx_rates_select_authenticated', {
      for: 'select',
      to: authenticatedRole,
      using: sql`true`,
    }),
  ]
)
