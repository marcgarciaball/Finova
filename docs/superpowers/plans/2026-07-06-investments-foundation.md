# Investments Foundation (A1+A2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the Inversiones persistence layer (ten tables + RLS + row validation + service-role client) and the pure average-cost holdings/portfolio calculation core.

**Architecture:** Drizzle schema modules (one per table group) generate a single migration; RLS is default-deny with own-row policies for user tables, SELECT-only for derived/shared tables (all derived/shared writes go through a new service-role client). The calculation core is pure functions in `lib/domain/investments/` with no I/O, fully TDD.

**Tech Stack:** Drizzle ORM (pgTable + pgPolicy), Supabase (`@supabase/supabase-js` service-role client), zod v4, Vitest.

**Design spec:** `docs/superpowers/specs/2026-07-06-investments-foundation-design.md`

## Global Constraints

- npm + Biome; gate: `npm run test && npm run typecheck && npm run lint`.
- Money is integer cents; the only non-integer numeric is `quantity` (≤ 8 decimal places), `fx rate` (≤ 8 dp) and `amount_per_share` (≤ 6 dp). Never sum across currencies without FX conversion.
- New tables: `investment_accounts` / `investment_transactions` (NOT `accounts`/`transactions` — those exist).
- Derived tables (`holdings`, `portfolio_snapshots`) and shared tables (`assets`, `cached_quotes`, `historical_prices`, `dividend_events`, `fx_rates`): users get SELECT only; no user write policies.
- `npm run db:migrate` needs a live DB — the agent's sandbox has none; migration application is a human step. `npm run db:generate` runs offline and is an agent step.
- No UI changes anywhere in this plan.

---

### Task 1: Drizzle schema — user-owned tables

**Files:**
- Create: `lib/db/schema/investments-portfolios.ts`
- Create: `lib/db/schema/investments-transactions.ts`
- Modify: `lib/db/schema/index.ts` (barrel)

**Interfaces:**
- Consumes: `authUsers`, `authenticatedRole` from `drizzle-orm/supabase`; `assets` from Task 2's `lib/db/schema/investments-reference.ts` — **implement Task 2's file first if working out of order** (Task 3 generates the migration only after Tasks 1–2).
- Produces: `portfolios`, `investmentAccounts`, `investmentTransactions` pgTable exports.

- [x] **Step 1: Create `lib/db/schema/investments-portfolios.ts`**

```ts
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
```

- [x] **Step 2: Create `lib/db/schema/investments-transactions.ts`**

```ts
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
  uuid,
} from 'drizzle-orm/pg-core'
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase'
import { investmentAccounts, portfolios } from '@/lib/db/schema/investments-portfolios'
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
    check(
      'investment_transactions_quantity_check',
      sql`${table.quantity} > 0`
    ),
    check(
      'investment_transactions_price_check',
      sql`${table.priceCents} >= 0`
    ),
    check(
      'investment_transactions_fees_check',
      sql`${table.feesCents} >= 0`
    ),
    check(
      'investment_transactions_currency_check',
      sql`${table.currency} ~ '^[A-Z]{3}$'`
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
```

- [x] **Step 3: Add both modules to the barrel**

In `lib/db/schema/index.ts`, add (keeping alphabetical order):

```ts
export * from '@/lib/db/schema/investments-portfolios'
export * from '@/lib/db/schema/investments-reference'
export * from '@/lib/db/schema/investments-transactions'
```

(`investments-reference` is Task 2's file — the barrel line lands here so one commit at the end of Task 2 compiles; if committing Task 1 standalone, omit that line until Task 2.)

- [x] **Step 4: Verify**

Run: `npm run typecheck`
Expected: PASS only once Task 2's `investments-reference.ts` exists (the transactions module imports `assets`). Implement Tasks 1–2 back-to-back, then verify.

---

### Task 2: Drizzle schema — derived + shared reference tables

**Files:**
- Create: `lib/db/schema/investments-reference.ts`
- Create: `lib/db/schema/investments-derived.ts`
- Modify: `lib/db/schema/index.ts` (add `export * from '@/lib/db/schema/investments-derived'`)

**Interfaces:**
- Consumes: `portfolios` from Task 1.
- Produces: `assets`, `cachedQuotes`, `historicalPrices`, `dividendEvents`, `fxRates`, `holdings`, `portfolioSnapshots` pgTable exports. Task 1's transactions module imports `assets`.

- [x] **Step 1: Create `lib/db/schema/investments-reference.ts`**

```ts
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
```

- [x] **Step 2: Create `lib/db/schema/investments-derived.ts`**

```ts
import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  date,
  index,
  numeric,
  pgPolicy,
  pgTable,
  timestamp,
  text,
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
```

- [x] **Step 3: Complete the barrel**

`lib/db/schema/index.ts` now includes all four new modules:

```ts
export * from '@/lib/db/schema/investments-derived'
export * from '@/lib/db/schema/investments-portfolios'
export * from '@/lib/db/schema/investments-reference'
export * from '@/lib/db/schema/investments-transactions'
```

- [x] **Step 4: Verify and commit Tasks 1+2 together**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add lib/db/schema/
git commit -m "feat(investments): drizzle schema for portfolios, transactions, derived and reference tables"
```

---

### Task 3: Generate the migration + updated_at triggers

**Files:**
- Create: `drizzle/00XX_*.sql` (generated — number assigned by drizzle-kit)
- Create: `drizzle/meta/*` (generated)

**Interfaces:**
- Consumes: Tasks 1–2 schema modules via the barrel.
- Produces: the migration a human applies with `npm run db:migrate`.

- [x] **Step 1: Generate**

Run: `npm run db:generate`
Expected: a new `drizzle/00XX_<name>.sql` creating ten tables with policies and `ENABLE ROW LEVEL SECURITY` on each.

- [x] **Step 2: Hand-append updated_at triggers**

The `set_updated_at()` function exists from migration 0000. Append to the generated SQL file (after the last generated statement, using the `--> statement-breakpoint` separator convention):

```sql
--> statement-breakpoint
-- ---------------------------------------------------------------------------
-- Hand-added: maintain updated_at (function defined in 0000).
-- ---------------------------------------------------------------------------
CREATE TRIGGER portfolios_set_updated_at
  BEFORE UPDATE ON public.portfolios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
CREATE TRIGGER investment_transactions_set_updated_at
  BEFORE UPDATE ON public.investment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
CREATE TRIGGER assets_set_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
CREATE TRIGGER cached_quotes_set_updated_at
  BEFORE UPDATE ON public.cached_quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

- [x] **Step 3: Review the generated SQL**

Read the file and confirm: table names `investment_accounts`/`investment_transactions` (no collision), every user table has 4 policies, `holdings`/`portfolio_snapshots` have exactly 1 SELECT policy, shared tables have exactly 1 SELECT policy with `USING (true)`, RLS enabled on all ten.

- [x] **Step 4: Commit**

```bash
git add drizzle/
git commit -m "feat(investments): migration for the ten Inversiones tables + RLS"
```

- [ ] **Step 5 (human): Apply**

Human runs `npm run db:migrate` against the project DB (agent sandbox has no DB access) and reports the result.

---

### Task 4: Service-role admin client

**Files:**
- Create: `lib/supabase/admin.ts`

**Interfaces:**
- Consumes: `getServerEnv()` from `@/lib/validation/env.server` (already exposes optional `SUPABASE_SERVICE_ROLE_KEY`), `getClientEnv()` from `@/lib/validation/env`.
- Produces: `createAdminClient(): SupabaseClient` — throws if the key is unset. Slices A4/A5 use it for every shared/derived-table write.

- [x] **Step 1: Create `lib/supabase/admin.ts`**

```ts
import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getClientEnv } from '@/lib/validation/env'
import { getServerEnv } from '@/lib/validation/env.server'

/**
 * Service-role Supabase client (Inversiones A1). Bypasses RLS — the ONLY
 * legitimate writer of the shared market-reference tables (assets,
 * cached_quotes, historical_prices, dividend_events, fx_rates) and the
 * derived tables (holdings, portfolio_snapshots), which have no user write
 * policies at all. Server-only by import; never cache in a module global.
 */
export function createAdminClient() {
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv()
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set — required for investment data writes'
    )
  }
  const env = getClientEnv()
  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

- [x] **Step 2: Verify and commit**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add lib/supabase/admin.ts
git commit -m "feat(investments): service-role admin client for shared-table writes"
```

---

### Task 5: Domain types + zod row schemas

**Files:**
- Create: `lib/domain/investments/types.ts`
- Create: `lib/validation/investments.ts`
- Test: `lib/validation/investments.test.ts`

**Interfaces:**
- Consumes: `currencySchema` from `@/lib/validation/account`.
- Produces:
  - `ASSET_TYPES`, `AssetType`, `QUOTE_TYPES`, `QuoteType`, `INVESTMENT_TXN_TYPES`, `InvestmentTxnType` (types.ts) — Tasks 6–8 and all later slices use `AssetType`.
  - Row schemas + inferred types: `assetRowSchema`/`AssetRow`, `portfolioRowSchema`/`PortfolioRow`, `investmentAccountRowSchema`/`InvestmentAccountRow`, `investmentTransactionRowSchema`/`InvestmentTransactionRow`, `holdingRowSchema`/`HoldingRow`, `cachedQuoteRowSchema`/`CachedQuoteRow`, `portfolioSnapshotRowSchema`/`PortfolioSnapshotRow`, `fxRateRowSchema`/`FxRateRow`.
  - `decimalPlacesAtMost(n)` refinement helper (exported for reuse).

- [x] **Step 1: Create `lib/domain/investments/types.ts`**

```ts
/** Inversiones (A1): closed vocabularies shared by schema, domain and UI. */
export const ASSET_TYPES = ['stock', 'etf', 'fund', 'crypto'] as const
export type AssetType = (typeof ASSET_TYPES)[number]

export const QUOTE_TYPES = ['live', 'delayed', 'eod', 'nav', 'stale'] as const
export type QuoteType = (typeof QUOTE_TYPES)[number]

export const INVESTMENT_TXN_TYPES = ['buy', 'sell'] as const
export type InvestmentTxnType = (typeof INVESTMENT_TXN_TYPES)[number]
```

- [x] **Step 2: Write the failing tests**

Create `lib/validation/investments.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  assetRowSchema,
  cachedQuoteRowSchema,
  fxRateRowSchema,
  holdingRowSchema,
  investmentAccountRowSchema,
  investmentTransactionRowSchema,
  portfolioRowSchema,
  portfolioSnapshotRowSchema,
} from './investments'

const uuid = '11111111-1111-4111-8111-111111111111'
const ts = '2026-01-01T00:00:00Z'

const asset = {
  id: uuid,
  type: 'stock',
  ticker: 'AAPL',
  isin: 'US0378331005',
  coingecko_id: null,
  exchange: 'NASDAQ',
  name: 'Apple Inc.',
  currency: 'USD',
  provider_meta: {},
  created_at: ts,
  updated_at: ts,
}

const txn = {
  id: uuid,
  user_id: uuid,
  portfolio_id: uuid,
  account_id: null,
  asset_id: uuid,
  type: 'buy',
  quantity: 1.5,
  price_cents: 19000,
  currency: 'USD',
  fees_cents: 100,
  traded_at: '2026-01-02',
  notes: null,
  created_at: ts,
  updated_at: ts,
  edited_at: null,
  edit_reason: null,
}

describe('assetRowSchema', () => {
  it('accepts a stock row', () => {
    expect(assetRowSchema.parse(asset)).toEqual(asset)
  })
  it('rejects an unknown type', () => {
    expect(assetRowSchema.safeParse({ ...asset, type: 'bond' }).success).toBe(
      false
    )
  })
  it('rejects a bad currency', () => {
    expect(
      assetRowSchema.safeParse({ ...asset, currency: 'usd' }).success
    ).toBe(false)
  })
})

describe('investmentTransactionRowSchema', () => {
  it('accepts a buy row and coerces numeric-as-string quantity', () => {
    expect(
      investmentTransactionRowSchema.parse({ ...txn, quantity: '1.50000000' })
        .quantity
    ).toBe(1.5)
  })
  it('rejects non-positive quantity', () => {
    expect(
      investmentTransactionRowSchema.safeParse({ ...txn, quantity: 0 }).success
    ).toBe(false)
  })
  it('rejects more than 8 decimal places', () => {
    expect(
      investmentTransactionRowSchema.safeParse({
        ...txn,
        quantity: 0.000000001,
      }).success
    ).toBe(false)
  })
  it('rejects an unknown txn type', () => {
    expect(
      investmentTransactionRowSchema.safeParse({ ...txn, type: 'short' })
        .success
    ).toBe(false)
  })
  it('rejects non-integer cents', () => {
    expect(
      investmentTransactionRowSchema.safeParse({ ...txn, price_cents: 1.5 })
        .success
    ).toBe(false)
  })
})

describe('remaining row schemas', () => {
  it('portfolioRowSchema round-trips', () => {
    const row = {
      id: uuid,
      user_id: uuid,
      name: 'My Portfolio',
      base_currency: 'EUR',
      created_at: ts,
      updated_at: ts,
    }
    expect(portfolioRowSchema.parse(row)).toEqual(row)
  })
  it('investmentAccountRowSchema round-trips', () => {
    const row = {
      id: uuid,
      portfolio_id: uuid,
      user_id: uuid,
      name: 'DEGIRO',
      currency: 'EUR',
      created_at: ts,
    }
    expect(investmentAccountRowSchema.parse(row)).toEqual(row)
  })
  it('holdingRowSchema accepts nullable price fields', () => {
    const row = {
      id: uuid,
      user_id: uuid,
      portfolio_id: uuid,
      asset_id: uuid,
      quantity: 10,
      avg_cost_cents: 19100,
      invested_cents: 191000,
      realized_pl_cents: 0,
      current_price_cents: null,
      current_value_cents: null,
      unrealized_pl_cents: null,
      unrealized_pl_pct: null,
      dividends_cents: 0,
      last_computed_at: null,
    }
    expect(holdingRowSchema.parse(row)).toEqual(row)
  })
  it('cachedQuoteRowSchema rejects an unknown quote_type', () => {
    const row = {
      id: uuid,
      asset_id: uuid,
      price_cents: 100,
      currency: 'USD',
      quote_type: 'realtime',
      stale: false,
      provider: 'finnhub',
      fetched_at: ts,
      updated_at: ts,
    }
    expect(cachedQuoteRowSchema.safeParse(row).success).toBe(false)
  })
  it('portfolioSnapshotRowSchema round-trips', () => {
    const row = {
      id: uuid,
      portfolio_id: uuid,
      user_id: uuid,
      snapshot_date: '2026-01-02',
      total_value_cents: 123456,
      base_currency: 'EUR',
    }
    expect(portfolioSnapshotRowSchema.parse(row)).toEqual(row)
  })
  it('fxRateRowSchema rejects a non-positive rate', () => {
    const row = {
      id: uuid,
      from_ccy: 'USD',
      to_ccy: 'EUR',
      rate: 0,
      rate_date: '2026-01-02',
    }
    expect(fxRateRowSchema.safeParse(row).success).toBe(false)
  })
})
```

- [x] **Step 3: Run tests to verify they fail**

Run: `npx vitest run lib/validation/investments.test.ts`
Expected: FAIL — cannot resolve `./investments`.

- [x] **Step 4: Implement `lib/validation/investments.ts`**

```ts
import { z } from 'zod'
import {
  ASSET_TYPES,
  INVESTMENT_TXN_TYPES,
  QUOTE_TYPES,
} from '@/lib/domain/investments/types'
import { currencySchema } from '@/lib/validation/account'

/**
 * Inversiones row schemas (A1) — the single source of truth for the runtime
 * shape of each Supabase row, parsed at every data boundary (accountRowSchema
 * pattern). Postgres `numeric` may arrive as number or string depending on
 * the driver, so fractional columns coerce; money columns must be integers.
 *
 * Documented limitation: quantities are IEEE doubles in JS — exact for
 * realistic magnitudes (≤ ~9e7 units at 8 dp); money itself is never floated.
 */

/** True when `v` has at most `dp` decimal places (tolerant of float noise). */
export function decimalPlacesAtMost(dp: number) {
  return (v: number) => {
    const scaled = v * 10 ** dp
    return Math.abs(scaled - Math.round(scaled)) < 1e-3
  }
}

const idSchema = z.string().min(1)
const centsSchema = z.coerce.number().int()
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const quantitySchema = z.coerce
  .number()
  .positive()
  .refine(decimalPlacesAtMost(8), 'tooManyDecimals')

export const assetRowSchema = z.object({
  id: idSchema,
  type: z.enum(ASSET_TYPES),
  ticker: z.string().nullable(),
  isin: z.string().nullable(),
  coingecko_id: z.string().nullable(),
  exchange: z.string().nullable(),
  name: z.string(),
  currency: currencySchema,
  provider_meta: z.record(z.string(), z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
})
export type AssetRow = z.infer<typeof assetRowSchema>

export const portfolioRowSchema = z.object({
  id: idSchema,
  user_id: idSchema,
  name: z.string(),
  base_currency: currencySchema,
  created_at: z.string(),
  updated_at: z.string(),
})
export type PortfolioRow = z.infer<typeof portfolioRowSchema>

export const investmentAccountRowSchema = z.object({
  id: idSchema,
  portfolio_id: idSchema,
  user_id: idSchema,
  name: z.string(),
  currency: currencySchema,
  created_at: z.string(),
})
export type InvestmentAccountRow = z.infer<typeof investmentAccountRowSchema>

export const investmentTransactionRowSchema = z.object({
  id: idSchema,
  user_id: idSchema,
  portfolio_id: idSchema,
  account_id: idSchema.nullable(),
  asset_id: idSchema,
  type: z.enum(INVESTMENT_TXN_TYPES),
  quantity: quantitySchema,
  price_cents: centsSchema.nonnegative(),
  currency: currencySchema,
  fees_cents: centsSchema.nonnegative(),
  traded_at: isoDateSchema,
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  edited_at: z.string().nullable(),
  edit_reason: z.string().nullable(),
})
export type InvestmentTransactionRow = z.infer<
  typeof investmentTransactionRowSchema
>

export const holdingRowSchema = z.object({
  id: idSchema,
  user_id: idSchema,
  portfolio_id: idSchema,
  asset_id: idSchema,
  quantity: z.coerce
    .number()
    .nonnegative()
    .refine(decimalPlacesAtMost(8), 'tooManyDecimals'),
  avg_cost_cents: centsSchema,
  invested_cents: centsSchema,
  realized_pl_cents: centsSchema,
  current_price_cents: centsSchema.nullable(),
  current_value_cents: centsSchema.nullable(),
  unrealized_pl_cents: centsSchema.nullable(),
  unrealized_pl_pct: z.coerce.number().nullable(),
  dividends_cents: centsSchema,
  last_computed_at: z.string().nullable(),
})
export type HoldingRow = z.infer<typeof holdingRowSchema>

export const cachedQuoteRowSchema = z.object({
  id: idSchema,
  asset_id: idSchema,
  price_cents: centsSchema,
  currency: currencySchema,
  quote_type: z.enum(QUOTE_TYPES),
  stale: z.boolean(),
  provider: z.string(),
  fetched_at: z.string(),
  updated_at: z.string(),
})
export type CachedQuoteRow = z.infer<typeof cachedQuoteRowSchema>

export const portfolioSnapshotRowSchema = z.object({
  id: idSchema,
  portfolio_id: idSchema,
  user_id: idSchema,
  snapshot_date: isoDateSchema,
  total_value_cents: centsSchema,
  base_currency: currencySchema,
})
export type PortfolioSnapshotRow = z.infer<typeof portfolioSnapshotRowSchema>

export const fxRateRowSchema = z.object({
  id: idSchema,
  from_ccy: currencySchema,
  to_ccy: currencySchema,
  rate: z.coerce
    .number()
    .positive()
    .refine(decimalPlacesAtMost(8), 'tooManyDecimals'),
  rate_date: isoDateSchema,
})
export type FxRateRow = z.infer<typeof fxRateRowSchema>
```

- [x] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/validation/investments.test.ts`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add lib/domain/investments/types.ts lib/validation/investments.ts lib/validation/investments.test.ts
git commit -m "feat(investments): domain vocabularies + zod row schemas"
```

---

### Task 6: Average-cost holdings engine

**Files:**
- Create: `lib/domain/investments/holdings.ts`
- Test: `lib/domain/investments/holdings.test.ts`

**Interfaces:**
- Consumes: nothing external (pure).
- Produces:
  - `interface HoldingTxn { type: 'buy' | 'sell'; quantity: number; priceCents: number; feesCents: number; currency: string; tradedAt: string }`
  - `interface HoldingComputation { quantity: number; avgCostCents: number; investedCents: number; realizedPlCents: number }`
  - `computeHolding(txns: HoldingTxn[]): HoldingComputation`
  - `class OversellError extends Error { txnIndex: number; tradedAt: string }`
  - `class MixedCurrencyError extends Error {}`

Semantics (average-cost):
- Process in `tradedAt` order; ties keep input order (stable sort).
- Buy: `basis += quantity × priceCents + feesCents` (basis kept as an exact float internally, rounded only at output); `qty += quantity`.
- Sell: `avg = basis / qty` (unrounded); `realized += quantity × (priceCents − avg) − feesCents`; `basis −= quantity × avg`; `qty −= quantity`.
- Quantities compared/accumulated as integer 1e-8 units (`Math.round(q * 1e8)`) so 8-dp crypto math is exact; oversell = sell units > held units.
- Output: `avgCostCents = qty > 0 ? Math.round(basis / qty) : 0`, `investedCents = Math.round(basis)` (0 when fully liquidated), `realizedPlCents = Math.round(realized)`.
- Any two txns with different `currency` → `MixedCurrencyError` (one holding is single-currency by construction).

- [x] **Step 1: Write the failing tests**

Create `lib/domain/investments/holdings.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  computeHolding,
  type HoldingTxn,
  MixedCurrencyError,
  OversellError,
} from './holdings'

function buy(
  quantity: number,
  priceCents: number,
  opts: Partial<HoldingTxn> = {}
): HoldingTxn {
  return {
    type: 'buy',
    quantity,
    priceCents,
    feesCents: 0,
    currency: 'USD',
    tradedAt: '2026-01-01',
    ...opts,
  }
}

function sell(
  quantity: number,
  priceCents: number,
  opts: Partial<HoldingTxn> = {}
): HoldingTxn {
  return { ...buy(quantity, priceCents, opts), type: 'sell' }
}

describe('computeHolding', () => {
  it('returns the empty holding for no transactions', () => {
    expect(computeHolding([])).toEqual({
      quantity: 0,
      avgCostCents: 0,
      investedCents: 0,
      realizedPlCents: 0,
    })
  })

  it('computes a single buy with fees folded into cost basis', () => {
    const h = computeHolding([buy(10, 19000, { feesCents: 500 })])
    expect(h.quantity).toBe(10)
    expect(h.investedCents).toBe(190500)
    expect(h.avgCostCents).toBe(19050)
    expect(h.realizedPlCents).toBe(0)
  })

  it('weight-averages multiple buys', () => {
    // 10 @ 100.00 + 20 @ 130.00 → avg 120.00
    const h = computeHolding([buy(10, 10000), buy(20, 13000)])
    expect(h.quantity).toBe(30)
    expect(h.avgCostCents).toBe(12000)
    expect(h.investedCents).toBe(360000)
  })

  it('sells at average cost and realizes P/L net of fees', () => {
    // buy 10 @ 100.00, sell 4 @ 150.00 with 2.00 fees
    const h = computeHolding([
      buy(10, 10000),
      sell(4, 15000, { feesCents: 200, tradedAt: '2026-02-01' }),
    ])
    expect(h.quantity).toBe(6)
    expect(h.avgCostCents).toBe(10000) // unchanged by the sell
    expect(h.investedCents).toBe(60000)
    expect(h.realizedPlCents).toBe(4 * (15000 - 10000) - 200)
  })

  it('handles buy-sell-buy sequences', () => {
    const h = computeHolding([
      buy(10, 10000, { tradedAt: '2026-01-01' }),
      sell(5, 12000, { tradedAt: '2026-02-01' }),
      buy(5, 8000, { tradedAt: '2026-03-01' }),
    ])
    // After sell: 5 @ 100.00 basis 50000. Buy 5 @ 80.00 → basis 90000 / 10.
    expect(h.quantity).toBe(10)
    expect(h.avgCostCents).toBe(9000)
    expect(h.investedCents).toBe(90000)
    expect(h.realizedPlCents).toBe(5 * (12000 - 10000))
  })

  it('fully liquidates to a zero position', () => {
    const h = computeHolding([
      buy(3, 10000),
      sell(3, 11000, { tradedAt: '2026-02-01' }),
    ])
    expect(h.quantity).toBe(0)
    expect(h.investedCents).toBe(0)
    expect(h.avgCostCents).toBe(0)
    expect(h.realizedPlCents).toBe(3000)
  })

  it('orders by tradedAt regardless of input order', () => {
    // The sell happens AFTER both buys chronologically.
    const h = computeHolding([
      sell(15, 12000, { tradedAt: '2026-03-01' }),
      buy(10, 10000, { tradedAt: '2026-01-01' }),
      buy(10, 14000, { tradedAt: '2026-02-01' }),
    ])
    expect(h.quantity).toBe(5)
    expect(h.avgCostCents).toBe(12000)
  })

  it('is exact for 8-decimal crypto quantities', () => {
    const h = computeHolding([
      buy(0.1, 5000000000),
      buy(0.2, 5000000000, { tradedAt: '2026-01-02' }),
      sell(0.29999999, 6000000000, { tradedAt: '2026-01-03' }),
    ])
    expect(h.quantity).toBeCloseTo(0.00000001, 10)
    expect(h.realizedPlCents).toBe(Math.round(0.29999999 * 1000000000))
  })

  it('throws OversellError when selling more than held', () => {
    expect(() =>
      computeHolding([
        buy(1, 10000),
        sell(2, 10000, { tradedAt: '2026-02-01' }),
      ])
    ).toThrow(OversellError)
  })

  it('reports the offending transaction on oversell', () => {
    try {
      computeHolding([
        buy(1, 10000),
        sell(2, 10000, { tradedAt: '2026-02-01' }),
      ])
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(OversellError)
      expect((e as OversellError).tradedAt).toBe('2026-02-01')
      expect((e as OversellError).txnIndex).toBe(1)
    }
  })

  it('throws MixedCurrencyError on mixed currencies', () => {
    expect(() =>
      computeHolding([buy(1, 10000), buy(1, 10000, { currency: 'EUR' })])
    ).toThrow(MixedCurrencyError)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/domain/investments/holdings.test.ts`
Expected: FAIL — cannot resolve `./holdings`.

- [x] **Step 3: Implement `lib/domain/investments/holdings.ts`**

```ts
/**
 * Average-cost holdings engine (Inversiones A2). Pure: rebuilds one asset's
 * position from its transaction log. Quantities are handled as integer 1e-8
 * units so 8-dp crypto math is exact; the cost basis is accumulated as an
 * exact float and rounded to integer cents only at the output boundary.
 */

export interface HoldingTxn {
  type: 'buy' | 'sell'
  quantity: number // > 0, ≤ 8 decimal places
  priceCents: number // per unit, integer cents, native currency
  feesCents: number
  currency: string
  tradedAt: string // ISO date
}

export interface HoldingComputation {
  quantity: number
  avgCostCents: number // per unit, 0 when flat
  investedCents: number // remaining cost basis
  realizedPlCents: number // accumulated from sells, net of sell fees
}

export class OversellError extends Error {
  constructor(
    readonly txnIndex: number,
    readonly tradedAt: string
  ) {
    super(`sell exceeds held quantity (txn ${txnIndex} @ ${tradedAt})`)
    this.name = 'OversellError'
  }
}

export class MixedCurrencyError extends Error {
  constructor() {
    super('holding transactions must share one currency')
    this.name = 'MixedCurrencyError'
  }
}

const QTY_SCALE = 1e8

const toUnits = (quantity: number): number => Math.round(quantity * QTY_SCALE)

export function computeHolding(txns: HoldingTxn[]): HoldingComputation {
  const currency = txns[0]?.currency
  if (currency !== undefined && txns.some((t) => t.currency !== currency)) {
    throw new MixedCurrencyError()
  }

  // Stable sort by trade date; ties keep input order. Keep the original index
  // for error reporting.
  const ordered = txns
    .map((txn, index) => ({ txn, index }))
    .sort((a, b) => a.txn.tradedAt.localeCompare(b.txn.tradedAt))

  let heldUnits = 0
  let basisCents = 0
  let realizedCents = 0

  for (const { txn, index } of ordered) {
    const units = toUnits(txn.quantity)
    if (txn.type === 'buy') {
      basisCents += (units / QTY_SCALE) * txn.priceCents + txn.feesCents
      heldUnits += units
      continue
    }
    if (units > heldUnits) {
      throw new OversellError(index, txn.tradedAt)
    }
    const avg = basisCents / (heldUnits / QTY_SCALE) // cents per unit, unrounded
    const qty = units / QTY_SCALE
    realizedCents += qty * (txn.priceCents - avg) - txn.feesCents
    basisCents -= qty * avg
    heldUnits -= units
  }

  const quantity = heldUnits / QTY_SCALE
  return {
    quantity,
    avgCostCents: heldUnits > 0 ? Math.round(basisCents / quantity) : 0,
    investedCents: heldUnits > 0 ? Math.round(basisCents) : 0,
    realizedPlCents: Math.round(realizedCents),
  }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/domain/investments/holdings.test.ts`
Expected: PASS (11 tests).

- [x] **Step 5: Commit**

```bash
git add lib/domain/investments/holdings.ts lib/domain/investments/holdings.test.ts
git commit -m "feat(investments): average-cost holdings engine"
```

---

### Task 7: Position valuation

**Files:**
- Create: `lib/domain/investments/valuation.ts`
- Test: `lib/domain/investments/valuation.test.ts`

**Interfaces:**
- Consumes: nothing external (pure).
- Produces: `valueHolding(h: { quantity: number; investedCents: number }, currentPriceCents: number | null): { currentValueCents: number | null; unrealizedPlCents: number | null; unrealizedPlPct: number | null }`.

- [x] **Step 1: Write the failing tests**

Create `lib/domain/investments/valuation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { valueHolding } from './valuation'

describe('valueHolding', () => {
  it('values a position at the current price', () => {
    const v = valueHolding({ quantity: 10, investedCents: 100000 }, 12000)
    expect(v.currentValueCents).toBe(120000)
    expect(v.unrealizedPlCents).toBe(20000)
    expect(v.unrealizedPlPct).toBeCloseTo(20, 6)
  })

  it('rounds fractional-quantity values once', () => {
    const v = valueHolding({ quantity: 0.333, investedCents: 1000 }, 10000)
    expect(v.currentValueCents).toBe(3330)
  })

  it('returns all nulls without a quote', () => {
    expect(valueHolding({ quantity: 10, investedCents: 100000 }, null)).toEqual(
      { currentValueCents: null, unrealizedPlCents: null, unrealizedPlPct: null }
    )
  })

  it('guards the percentage when invested is zero', () => {
    const v = valueHolding({ quantity: 1, investedCents: 0 }, 5000)
    expect(v.currentValueCents).toBe(5000)
    expect(v.unrealizedPlCents).toBe(5000)
    expect(v.unrealizedPlPct).toBeNull()
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/domain/investments/valuation.test.ts`
Expected: FAIL — cannot resolve `./valuation`.

- [x] **Step 3: Implement `lib/domain/investments/valuation.ts`**

```ts
/**
 * Position valuation (Inversiones A2). Pure. Null price (no cached quote yet)
 * propagates as null valuation — callers surface a freshness caveat instead
 * of pretending the position is worth zero.
 */
export function valueHolding(
  holding: { quantity: number; investedCents: number },
  currentPriceCents: number | null
): {
  currentValueCents: number | null
  unrealizedPlCents: number | null
  unrealizedPlPct: number | null
} {
  if (currentPriceCents === null) {
    return {
      currentValueCents: null,
      unrealizedPlCents: null,
      unrealizedPlPct: null,
    }
  }
  const currentValueCents = Math.round(holding.quantity * currentPriceCents)
  const unrealizedPlCents = currentValueCents - holding.investedCents
  return {
    currentValueCents,
    unrealizedPlCents,
    unrealizedPlPct:
      holding.investedCents > 0
        ? (unrealizedPlCents / holding.investedCents) * 100
        : null,
  }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/domain/investments/valuation.test.ts`
Expected: PASS (4 tests).

- [x] **Step 5: Commit**

```bash
git add lib/domain/investments/valuation.ts lib/domain/investments/valuation.test.ts
git commit -m "feat(investments): position valuation"
```

---

### Task 8: FX conversion + portfolio totals

**Files:**
- Create: `lib/domain/investments/portfolio.ts`
- Test: `lib/domain/investments/portfolio.test.ts`

**Interfaces:**
- Consumes: `AssetType` from `./types` (Task 5).
- Produces:
  - `type FxRateTable = ReadonlyMap<string, number>`; `fxKey(from: string, to: string): string` (format `"USD->EUR"`); `class MissingRateError extends Error`.
  - `convertCents(amountCents: number, from: string, to: string, rates: FxRateTable): number` — identity when `from === to`, otherwise `Math.round(amountCents × rate)`, throws `MissingRateError` when unmapped.
  - `interface ValuedHolding { assetType: AssetType; currency: string; investedCents: number; currentValueCents: number | null; unrealizedPlPct: number | null }`
  - `interface PortfolioTotals { totalInvestedCents: number; pricedInvestedCents: number; totalValueCents: number; totalPlCents: number; totalPlPct: number | null; unpricedCount: number; allocationByType: Partial<Record<AssetType, number>>; allocationByCurrency: Record<string, number> }`
  - `computePortfolioTotals(holdings: ValuedHolding[], baseCurrency: string, rates: FxRateTable): PortfolioTotals`
  - `topMovers(holdings: ValuedHolding[], n: number): { winners: ValuedHolding[]; losers: ValuedHolding[] }`

Semantics:
- Cross-currency sums happen only here: each holding converts to base currency first (rounded once per holding), then integer cents are summed.
- `totalInvestedCents` covers ALL holdings; unpriced holdings (null value) are excluded from `totalValueCents`, P/L, and allocations, and counted in `unpricedCount`. `totalPlCents = totalValueCents − pricedInvestedCents` so unpriced positions don't masquerade as losses.
- `totalPlPct` is null when `pricedInvestedCents` is 0; allocations are fractions of `totalValueCents` (empty objects when 0).
- `topMovers` considers only holdings with non-null `unrealizedPlPct`; winners sorted descending, losers ascending; stable order on ties.

- [x] **Step 1: Write the failing tests**

Create `lib/domain/investments/portfolio.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  computePortfolioTotals,
  convertCents,
  type FxRateTable,
  fxKey,
  MissingRateError,
  topMovers,
  type ValuedHolding,
} from './portfolio'

const rates: FxRateTable = new Map([
  [fxKey('USD', 'EUR'), 0.9],
  [fxKey('GBP', 'EUR'), 1.2],
])

function holding(over: Partial<ValuedHolding>): ValuedHolding {
  return {
    assetType: 'stock',
    currency: 'EUR',
    investedCents: 100000,
    currentValueCents: 110000,
    unrealizedPlPct: 10,
    ...over,
  }
}

describe('convertCents', () => {
  it('is the identity within one currency (no rate needed)', () => {
    expect(convertCents(12345, 'EUR', 'EUR', new Map())).toBe(12345)
  })
  it('converts and rounds once', () => {
    expect(convertCents(10001, 'USD', 'EUR', rates)).toBe(9001) // 9000.9 → 9001
  })
  it('throws MissingRateError for an unmapped pair', () => {
    expect(() => convertCents(100, 'JPY', 'EUR', rates)).toThrow(
      MissingRateError
    )
  })
})

describe('computePortfolioTotals', () => {
  it('sums a single-currency portfolio', () => {
    const t = computePortfolioTotals(
      [holding({}), holding({ investedCents: 50000, currentValueCents: 40000 })],
      'EUR',
      new Map()
    )
    expect(t.totalInvestedCents).toBe(150000)
    expect(t.totalValueCents).toBe(150000)
    expect(t.totalPlCents).toBe(0)
    expect(t.totalPlPct).toBe(0)
    expect(t.unpricedCount).toBe(0)
  })

  it('converts foreign holdings to base currency before summing', () => {
    const t = computePortfolioTotals(
      [
        holding({ currency: 'USD', investedCents: 100000, currentValueCents: 120000 }),
        holding({}),
      ],
      'EUR',
      rates
    )
    expect(t.totalInvestedCents).toBe(90000 + 100000)
    expect(t.totalValueCents).toBe(108000 + 110000)
  })

  it('excludes unpriced holdings from value and P/L but not invested', () => {
    const t = computePortfolioTotals(
      [
        holding({}),
        holding({
          investedCents: 70000,
          currentValueCents: null,
          unrealizedPlPct: null,
        }),
      ],
      'EUR',
      new Map()
    )
    expect(t.totalInvestedCents).toBe(170000)
    expect(t.pricedInvestedCents).toBe(100000)
    expect(t.totalValueCents).toBe(110000)
    expect(t.totalPlCents).toBe(10000)
    expect(t.totalPlPct).toBeCloseTo(10, 6)
    expect(t.unpricedCount).toBe(1)
  })

  it('computes allocations as fractions of total value', () => {
    const t = computePortfolioTotals(
      [
        holding({ assetType: 'stock', currentValueCents: 75000 }),
        holding({ assetType: 'crypto', currency: 'USD', currentValueCents: 27778 }), // ≈25000 EUR
      ],
      'EUR',
      rates
    )
    expect(t.allocationByType.stock).toBeCloseTo(0.75, 3)
    expect(t.allocationByType.crypto).toBeCloseTo(0.25, 3)
    expect(t.allocationByCurrency.EUR).toBeCloseTo(0.75, 3)
    expect(t.allocationByCurrency.USD).toBeCloseTo(0.25, 3)
  })

  it('returns null percentage and empty allocations for an empty portfolio', () => {
    const t = computePortfolioTotals([], 'EUR', new Map())
    expect(t.totalPlPct).toBeNull()
    expect(t.allocationByType).toEqual({})
    expect(t.allocationByCurrency).toEqual({})
  })
})

describe('topMovers', () => {
  const hs = [
    holding({ unrealizedPlPct: 5 }),
    holding({ unrealizedPlPct: -20 }),
    holding({ unrealizedPlPct: 42 }),
    holding({ unrealizedPlPct: null }),
    holding({ unrealizedPlPct: -3 }),
  ]

  it('ranks winners descending and losers ascending, skipping unpriced', () => {
    const { winners, losers } = topMovers(hs, 2)
    expect(winners.map((h) => h.unrealizedPlPct)).toEqual([42, 5])
    expect(losers.map((h) => h.unrealizedPlPct)).toEqual([-20, -3])
  })

  it('returns fewer than n when the portfolio is small', () => {
    const { winners } = topMovers(hs, 10)
    expect(winners).toHaveLength(4)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/domain/investments/portfolio.test.ts`
Expected: FAIL — cannot resolve `./portfolio`.

- [x] **Step 3: Implement `lib/domain/investments/portfolio.ts`**

```ts
import type { AssetType } from '@/lib/domain/investments/types'

/**
 * Portfolio aggregation (Inversiones A2). Pure. The ONLY place cross-currency
 * sums happen: every holding converts to the base currency first (rounded
 * once per holding), then integer cents are summed. Unpriced holdings (no
 * cached quote yet) count toward invested but are excluded from value, P/L
 * and allocations — surfaced via `unpricedCount`, never silently.
 */

export type FxRateTable = ReadonlyMap<string, number>

export const fxKey = (from: string, to: string): string => `${from}->${to}`

export class MissingRateError extends Error {
  constructor(from: string, to: string) {
    super(`no FX rate for ${from}->${to}`)
    this.name = 'MissingRateError'
  }
}

export function convertCents(
  amountCents: number,
  from: string,
  to: string,
  rates: FxRateTable
): number {
  if (from === to) {
    return amountCents
  }
  const rate = rates.get(fxKey(from, to))
  if (rate === undefined) {
    throw new MissingRateError(from, to)
  }
  return Math.round(amountCents * rate)
}

export interface ValuedHolding {
  assetType: AssetType
  currency: string // asset's native currency
  investedCents: number
  currentValueCents: number | null
  unrealizedPlPct: number | null
}

export interface PortfolioTotals {
  totalInvestedCents: number
  pricedInvestedCents: number
  totalValueCents: number
  totalPlCents: number
  totalPlPct: number | null
  unpricedCount: number
  allocationByType: Partial<Record<AssetType, number>>
  allocationByCurrency: Record<string, number>
}

export function computePortfolioTotals(
  holdings: ValuedHolding[],
  baseCurrency: string,
  rates: FxRateTable
): PortfolioTotals {
  let totalInvestedCents = 0
  let pricedInvestedCents = 0
  let totalValueCents = 0
  let unpricedCount = 0
  const valueByType = new Map<AssetType, number>()
  const valueByCurrency = new Map<string, number>()

  for (const h of holdings) {
    const invested = convertCents(
      h.investedCents,
      h.currency,
      baseCurrency,
      rates
    )
    totalInvestedCents += invested
    if (h.currentValueCents === null) {
      unpricedCount += 1
      continue
    }
    const value = convertCents(
      h.currentValueCents,
      h.currency,
      baseCurrency,
      rates
    )
    pricedInvestedCents += invested
    totalValueCents += value
    valueByType.set(h.assetType, (valueByType.get(h.assetType) ?? 0) + value)
    valueByCurrency.set(
      h.currency,
      (valueByCurrency.get(h.currency) ?? 0) + value
    )
  }

  const totalPlCents = totalValueCents - pricedInvestedCents
  const allocationByType: Partial<Record<AssetType, number>> = {}
  const allocationByCurrency: Record<string, number> = {}
  if (totalValueCents > 0) {
    for (const [type, value] of valueByType) {
      allocationByType[type] = value / totalValueCents
    }
    for (const [ccy, value] of valueByCurrency) {
      allocationByCurrency[ccy] = value / totalValueCents
    }
  }

  return {
    totalInvestedCents,
    pricedInvestedCents,
    totalValueCents,
    totalPlCents,
    totalPlPct:
      pricedInvestedCents > 0
        ? (totalPlCents / pricedInvestedCents) * 100
        : null,
    unpricedCount,
    allocationByType,
    allocationByCurrency,
  }
}

export function topMovers(
  holdings: ValuedHolding[],
  n: number
): { winners: ValuedHolding[]; losers: ValuedHolding[] } {
  const priced = holdings.filter((h) => h.unrealizedPlPct !== null)
  const byPctDesc = [...priced].sort(
    (a, b) => (b.unrealizedPlPct ?? 0) - (a.unrealizedPlPct ?? 0)
  )
  return {
    winners: byPctDesc.slice(0, n),
    losers: [...byPctDesc].reverse().slice(0, n),
  }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/domain/investments/portfolio.test.ts`
Expected: PASS (10 tests).

- [x] **Step 5: Commit**

```bash
git add lib/domain/investments/portfolio.ts lib/domain/investments/portfolio.test.ts
git commit -m "feat(investments): FX conversion + portfolio totals"
```

---

### Task 9: Full-suite verification

**Files:** none (verification only).

- [x] **Step 1: Full suite**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 2 (human): Apply + smoke the migration**

Human runs `npm run db:migrate`, then confirms in Supabase Studio: ten new tables, RLS enabled everywhere, an authenticated user can SELECT but not INSERT into `assets`/`holdings`.
