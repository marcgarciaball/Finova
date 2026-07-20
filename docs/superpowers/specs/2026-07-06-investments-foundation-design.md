# Investments foundation: schema + domain core — design (Inversiones, slices A1–A2)

**Date:** 2026-07-06
**Source:** user-provided Inversiones build prompt (manual portfolio tracker with
market-data enrichment; no broker connection)
**Status:** Draft for review

## Context & decomposition

The Inversiones module is delivered in phases (A–E per the build prompt).
Phase A (foundation) is itself decomposed into independent spec → plan →
implementation slices:

- **A1. Schema migration + row validation** — this spec.
- **A2. Domain core** — pure holdings/portfolio calculations — this spec.
- **A3. Provider layer** — Finnhub + CoinGecko quote/search clients, FX client,
  provider-agnostic router. Separate spec.
- **A4. Add-transaction UI** — asset search, transaction form, server actions,
  default-portfolio bootstrap. Separate spec.
- **A5. Refresh job** — manual-trigger price refresh + holdings rebuild.
  Separate spec.

Build order: A1 → A2 → A3 → A4 → A5. Phases B–E (dashboard, income/insights,
performance, import/export) come later and are out of scope here.

### Decisions locked during brainstorming

- **Table naming:** the prompt's `accounts`/`transactions` collide with
  Finova's existing cash tables → new tables are `investment_accounts` and
  `investment_transactions`. Shared reference tables keep the prompt's names
  (`assets`, `cached_quotes`, `historical_prices`, `dividend_events`,
  `fx_rates`).
- **Sells in v1:** yes — buys + sells with the **average-cost** method.
  Realized P/L is computed and stored from day one, surfaced in UI later.
  Cost-basis method remains a calculation choice (FIFO later needs no schema
  change: the transaction log is the source of truth).
- **Nav placement (A4):** top-level nav tab `/protected/investments`, alongside
  Transactions and Accounts.
- **Provider scope (A3):** quote + search only. Finnhub's free tier no longer
  includes `/stock/candle` or `/stock/dividend2`; history/dividends pick a
  viable source in Phases C/D. FX uses **Frankfurter** (frankfurter.app, ECB
  daily, free, no key) — exchangerate.host now requires an API key.

## Goal (A1 + A2)

Land the persistence layer (tables, RLS, zod row schemas) and the pure
calculation core (average-cost holdings engine, FX-converted portfolio totals)
so every later slice builds on tested foundations.

## Non-goals

- No UI, routes, server actions, providers, or jobs (A3–A5).
- No FIFO cost basis (design allows it later; not implemented).
- No import/export code (Phase E; the transaction log shape anticipates it).
- No changes to existing cash `accounts`/`transactions` logic — investments
  are additive and isolated.

## A1 — Schema

One Drizzle migration adding ten tables, following the existing
`lib/db/schema/` + `drizzle/` patterns (snake_case, `timestamptz` defaults,
`set_updated_at` trigger reuse where a table has `updated_at`).

### User-owned tables (RLS default-deny, own-row policies)

```sql
CREATE TABLE portfolios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL DEFAULT 'My Portfolio',
  base_currency text NOT NULL DEFAULT 'EUR' CHECK (base_currency ~ '^[A-Z]{3}$'),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE investment_accounts (        -- broker/named account
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id  uuid NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  currency      text NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE investment_transactions (    -- raw user truth, never derived
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_id  uuid NOT NULL REFERENCES portfolios(id),
  account_id    uuid REFERENCES investment_accounts(id),
  asset_id      uuid NOT NULL REFERENCES assets(id),
  type          text NOT NULL CHECK (type IN ('buy','sell')),
  quantity      numeric(20,8) NOT NULL CHECK (quantity > 0),
  price_cents   bigint NOT NULL CHECK (price_cents >= 0),
  currency      text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  fees_cents    bigint NOT NULL DEFAULT 0 CHECK (fees_cents >= 0),
  traded_at     date NOT NULL,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  edited_at     timestamptz,              -- set on any manual edit
  edit_reason   text
);
```

Policies: `*_select_own` / `insert_own` / `update_own` / `delete_own` keyed on
`(select auth.uid()) = user_id` — same belt-and-suspenders stance as the cash
`accounts` table (app layer also calls `requireUser()` and derives ownership
from `claims.sub`, never the form).

### Derived tables (user-readable, job-written)

```sql
CREATE TABLE holdings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_id         uuid NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  asset_id             uuid NOT NULL REFERENCES assets(id),
  quantity             numeric(20,8) NOT NULL,
  avg_cost_cents       bigint NOT NULL,
  invested_cents       bigint NOT NULL,
  realized_pl_cents    bigint NOT NULL DEFAULT 0,   -- from sells (avg cost)
  current_price_cents  bigint,
  current_value_cents  bigint,
  unrealized_pl_cents  bigint,
  unrealized_pl_pct    numeric(10,4),
  dividends_cents      bigint NOT NULL DEFAULT 0,
  last_computed_at     timestamptz,
  UNIQUE (portfolio_id, asset_id)
);

CREATE TABLE portfolio_snapshots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id      uuid NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date     date NOT NULL,
  total_value_cents bigint NOT NULL,
  base_currency     text NOT NULL CHECK (base_currency ~ '^[A-Z]{3}$'),
  UNIQUE (portfolio_id, snapshot_date)
);
```

Policies: **SELECT-own only.** No user INSERT/UPDATE/DELETE policies — these
rows are derived state, rebuilt exclusively by the refresh job through the
service-role client. A crafted client request cannot corrupt them.

`holdings` gains `realized_pl_cents` over the prompt's shape (sells decision).

### Shared reference tables (no `user_id`)

```sql
CREATE TABLE assets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type          text NOT NULL CHECK (type IN ('stock','etf','fund','crypto')),
  ticker        text,
  isin          text,
  coingecko_id  text,                     -- crypto canonical id
  exchange      text,
  name          text NOT NULL,
  currency      text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  provider_meta jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticker, exchange),
  UNIQUE (isin),
  UNIQUE (coingecko_id)
);

CREATE TABLE cached_quotes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    uuid NOT NULL UNIQUE REFERENCES assets(id) ON DELETE CASCADE,
  price_cents bigint NOT NULL,
  currency    text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  quote_type  text NOT NULL CHECK (quote_type IN ('live','delayed','eod','nav','stale')),
  stale       boolean NOT NULL DEFAULT false,
  provider    text NOT NULL,
  fetched_at  timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE historical_prices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  date        date NOT NULL,
  open_cents  bigint,
  high_cents  bigint,
  low_cents   bigint,
  close_cents bigint NOT NULL,
  volume      bigint,
  currency    text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  UNIQUE (asset_id, date)
);

CREATE TABLE dividend_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id         uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  ex_date          date NOT NULL,
  pay_date         date,
  amount_per_share numeric(12,6) NOT NULL,
  currency         text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  provider         text NOT NULL,
  UNIQUE (asset_id, ex_date)
);

CREATE TABLE fx_rates (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_ccy  text NOT NULL CHECK (from_ccy ~ '^[A-Z]{3}$'),
  to_ccy    text NOT NULL CHECK (to_ccy ~ '^[A-Z]{3}$'),
  rate      numeric(18,8) NOT NULL CHECK (rate > 0),
  rate_date date NOT NULL,
  UNIQUE (from_ccy, to_ccy, rate_date)
);
```

Policies: SELECT for `authenticated`; **zero write policies.** All writes —
including the asset upsert when a user picks a provider search result (A4) —
go through a new server-only service-role client:

- `lib/supabase/admin.ts` — `createAdminClient()` using new env var
  `SUPABASE_SERVICE_ROLE_KEY` (server-side only, validated in
  `lib/validation/env.server.ts` alongside the pattern used for other server
  secrets; never imported by client code — `import 'server-only'`).

`historical_prices` and `dividend_events` are created now (one migration, no
follow-up churn) even though nothing populates them until Phases C/D.

### Row validation (zod, `accountRowSchema` pattern)

`lib/validation/investments.ts`:

- `assetRowSchema`, `portfolioRowSchema`, `investmentAccountRowSchema`,
  `investmentTransactionRowSchema`, `holdingRowSchema`, `cachedQuoteRowSchema`,
  `portfolioSnapshotRowSchema`, `fxRateRowSchema` — parsed at every data
  boundary.
- `quantity` (and `rate`, `amount_per_share`) arrive as JSON numbers; schemas
  coerce to `number` and reject more than 8 (resp. 8/6) decimal places.
  Documented limitation: quantities are IEEE doubles in JS — exact for
  realistic magnitudes (≤ ~9e7 units at 8 dp); money itself is never floated.
- Input schemas for forms/actions belong to A4, not here.

## A2 — Domain core

Pure functions, no I/O, under `lib/domain/investments/`. Money math reuses
`lib/domain/money` conventions (integer cents; rounding at the single point a
non-integer appears).

### `holdings.ts`

```ts
interface HoldingTxn {
  type: 'buy' | 'sell'
  quantity: number        // > 0, ≤ 8 dp
  priceCents: number      // per unit, native currency
  feesCents: number
  tradedAt: string        // ISO date
}

interface HoldingComputation {
  quantity: number
  avgCostCents: number        // per unit
  investedCents: number       // quantity × avgCost, rounded once
  realizedPlCents: number     // accumulated from sells
}

function computeHolding(txns: HoldingTxn[]): HoldingComputation
```

- Transactions are processed in `tradedAt` order (ties: input order).
- **Buy:** cost basis += quantity × priceCents + feesCents; quantity +=
  quantity; avg cost = basis / quantity (rounded to integer cents per unit
  only for display/storage — internal accumulation keeps the exact basis to
  avoid drift).
- **Sell:** realized P/L += quantity × (priceCents − avgCost) − feesCents;
  basis −= quantity × avgCost; quantity −= quantity.
- **Oversell** (sell quantity > held quantity at that point, with an epsilon
  for 8-dp float comparison) throws a typed `OversellError { assetIndex,
  tradedAt }` — A4's action maps it to a field error; the refresh job logs and
  skips the holding.
- All transactions for one holding are same-currency by construction (the
  asset's native currency); mixed currencies in input throw.

### `valuation.ts`

```ts
function valueHolding(h: { quantity: number; investedCents: number },
                      currentPriceCents: number | null): {
  currentValueCents: number | null
  unrealizedPlCents: number | null
  unrealizedPlPct: number | null   // null when investedCents is 0
}
```

### `portfolio.ts`

```ts
interface ValuedHolding {
  assetType: AssetType        // 'stock' | 'etf' | 'fund' | 'crypto'
  currency: string            // asset's native currency
  investedCents: number
  currentValueCents: number | null
  unrealizedPlPct: number | null
}

type FxRateTable = ReadonlyMap<string, number>  // "USD->EUR" → rate

function convertCents(amountCents: number, from: string, to: string,
                      rates: FxRateTable): number  // identity when from === to;
                                                   // throws MissingRateError otherwise-unmapped

interface PortfolioTotals {
  totalInvestedCents: number
  totalValueCents: number
  totalPlCents: number
  totalPlPct: number | null
  allocationByType: Record<AssetType, number>   // fraction of totalValue
  allocationByCurrency: Record<string, number>
}

function computePortfolioTotals(
  holdings: ValuedHolding[],   // native-currency cents + asset type + currency
  baseCurrency: string,
  rates: FxRateTable
): PortfolioTotals

function topMovers(holdings: ValuedHolding[], n: number):
  { winners: ValuedHolding[]; losers: ValuedHolding[] }  // by unrealizedPlPct
```

- Cross-currency sums happen **only** here, after per-holding conversion to
  base currency, on integer cents (converted amounts rounded once per
  holding).
- Holdings with `currentValueCents: null` (no quote yet) count toward
  invested but are excluded from value/allocations; callers surface that as a
  freshness caveat (A4/B concern).
- Division-by-zero guards: `totalPlPct`/`unrealizedPlPct` are `null` when the
  denominator is 0.

## Error handling

- Schema layer: malformed rows fail zod parsing at the data boundary (throw →
  error UI upstream), same as every other Finova table.
- Domain layer: typed errors (`OversellError`, `MissingRateError`,
  `MixedCurrencyError`) — callers decide presentation; pure functions never
  return partial results silently.

## Testing

- A1: migration applies via `npm run db:migrate` (human runs it against the
  project DB — sandbox has no DB access); zod schemas get unit tests with
  fixture rows (accept + reject per table) in `lib/validation/investments.test.ts`.
- A2: exhaustive Vitest suites per file — single buy, multiple buys (weighted
  average, fee folding), buy-sell-buy sequences, full liquidation, oversell,
  8-dp crypto quantities, mixed-currency rejection, FX conversion + identity +
  missing rate, zero-invested percentage guards, allocation fractions summing
  to 1, winners/losers ordering and tie behavior.
- RLS behavior (users can't write derived/shared tables) is asserted by
  policy shape in the migration and verified by a human smoke test in A4/A5
  (sandbox cannot reach the database).

## Definition of done

- Migration lands with all ten tables + policies; `npm run db:generate`
  output committed; human applies it successfully.
- `lib/supabase/admin.ts` exists, server-only, env validated.
- All row schemas + domain functions implemented with suites green:
  `npm run test && npm run typecheck && npm run lint`.
- No UI change anywhere (foundation only).
