# P4-04/05/06 — Dashboard surface + data export UI

Status: approved (2026-06-28)
Tickets: P4-01..P4-06 (UI surface). The pure cores (P4-01 summary, P4-02
by-category, P4-03 over-time, P4-05 serialize) are already shipped and tested;
this spec covers the **stateful surface** that consumes them: the dashboard
page, recent-transactions block, empty states, and the CSV/JSON export.
Phase: 4 — Dashboard & export

## Goal

Turn the existing pure dashboard/export cores + the `components/charts` /
`components/dashboard` primitives (built on `feat/component-foundation`) into:

- `/protected` — the **dashboard**: net cash flow, balances, savings rate
  (P4-01), spending-by-category chart+table (P4-02), income-vs-expense + balance
  trend over time (P4-03), recent transactions + quick filters (P4-04), empty
  states with next actions in both languages (P4-06).
- `/protected/export` — **export all data** to CSV + JSON, RLS-scoped (P4-05).

Browser verification (charts render, downloads work) is a manual gate item; this
sandbox can't run the dev server, so the deliverable is code-complete + green
typecheck/lint/test, marked REVIEW like the prior tickets.

## Decisions (locked)

1. **One data fetch, period-sliced in the domain.** `getDashboardData()` does a
   single RLS-enforced read of the user's accounts, categories, and a minimal
   transactions projection (`id, account_id, category_id, amount_cents, currency,
   is_transfer, occurred_at, description`), newest first, no page cap (totals
   must be exact — same rationale as `listTransactionsForTotals`). The page
   applies the **period filter in-domain** (pure `filterByPeriod`) before the
   period-sensitive cores; **balances + balance-trend always use all rows**
   (a balance is cumulative, not period-bounded).

2. **The dashboard renders one display currency at a time.** The cores return
   `Record<currency, …>`. The page picks a display currency — the profile
   `base_currency` if the user has activity in it, else the currency with the
   most transactions (pure `pickDisplayCurrency`) — and renders that currency's
   figures + charts. Other currencies are surfaced as a small note + a per-
   currency balance list, never summed across (the P1-07 no-FX invariant).

3. **Charts consume major-unit numbers; precise money stays in cards/tables.**
   recharts axes/tooltips work in numbers, so chart adapters divide cents by 100
   (pure, tested). The KPI tiles, the category table, and the recent-tx rows use
   the `money`/`format` module for exact, locale-aware currency text. This keeps
   the chart layer dumb and the money layer authoritative.

4. **Period selector is URL-driven** (`?period=30d|90d|ytd|12m|all`, default
   `90d`) so the view is shareable + server-rendered, mirroring
   `TransactionFilters`. A small client `PeriodSelector` (the existing
   `SegmentedControl`) pushes the param; the server page reads it.

5. **Export: JSON = full bundle, CSV = the transactions ledger.** CSV is a
   single table by nature; the transactions CSV is the one that must
   **round-trip back through import** (the gate). JSON carries the whole dataset
   (accounts + categories + transactions + a meta header). Two GET **route
   handlers** (`/protected/export/transactions.csv`, `/protected/export/data.json`)
   each `requireUser()`, RLS-fetch, build via pure cores, and return the file
   with `Content-Disposition: attachment`. The export **page** is just two
   download buttons + a one-line description and a "not financial advice"-style
   note is out of scope (P5-07).

6. **No new migration, no new domain math beyond adapters.** Everything reads
   existing tables through the RLS Supabase client. New pure code is limited to
   formatting/adapter glue, all unit-tested.

## New pure cores (TDD)

### `lib/domain/dashboard/period.ts`
```ts
export type Period = '30d' | '90d' | 'ytd' | '12m' | 'all'
export const PERIODS: Period[]
export function parsePeriod(raw: string | undefined): Period   // default '90d'
/** Inclusive lower bound ISO date for a period given today (UTC), or null for 'all'. */
export function periodStartIso(period: Period, todayIso: string): string | null
/** Keep txns with occurred_at >= start (all rows when 'all'). Pure. */
export function filterByPeriod<T extends { occurred_at: string }>(
  txns: T[], period: Period, todayIso: string
): T[]
```
Tests: each period computes the right start; `all` returns input unchanged;
boundary row on the start date is included; ytd = Jan 1 of today's year.

### `lib/domain/dashboard/display-currency.ts`
```ts
export function pickDisplayCurrency(
  txns: { currency: string }[], base: string
): string   // base if it has any txn, else the modal currency, else base
```
Tests: base chosen when present; modal currency when base absent; base as
fallback on empty input; deterministic tie-break (first by count then code).

### `lib/domain/dashboard/chart-data.ts` (pure adapters → recharts shapes)
```ts
// income vs expense bars, major units
export function monthlySeriesToBars(buckets: MonthBucket[]):
  { index: 'period'; categories: ['income','expense']; data: Record<string, number|string>[] }
// cumulative balance area, major units
export function balanceTrendToArea(points: TrendPoint[]):
  { index: 'period'; categories: ['balance']; data: Record<string, number|string>[] }
// donut slices, major units, labels resolved by caller
export function spendingToDonut(
  spend: CategorySpend[], label: (categoryId: string|null) => string
): { name: string; value: number }[]
```
Tests: cents→major conversion (÷100, 2-dp), period passthrough, empty input →
empty data, donut label resolution + null→"Uncategorized" label hook, order
preserved.

### `lib/domain/export/bundle.ts` (pure, builds on `toCsv`)
```ts
export interface ExportInput { accounts: AccountRow[]; categories: CategoryRow[]; transactions: TransactionRow[] }
export function transactionsCsv(txns: TransactionRow[]): string  // round-trips through parseCsv
export function buildJsonBundle(input: ExportInput, meta: { exportedAt: string; version: string }): object
```
Tests: transactions CSV has a stable header, amounts emitted verbatim
(round-trips through `parseCsv`/`rowsToRecords`), formula-trigger description
sanitized; JSON bundle includes meta + all three arrays; empty dataset → header-
only CSV / empty arrays. `exportedAt` is injected (never `Date.now()` in the
pure layer).

## Data + UI

- `app/protected/data.ts` — `getDashboardData()` (RLS-enforced; the single fetch
  from decision 1) returning `{ accounts, categories, txns, baseCurrency }`.
- `app/protected/page.tsx` — server component; reads `?period`, fetches, runs the
  cores, composes: `PeriodSelector`, KPI/Hero tiles (P4-01), `BarChart` income vs
  expense + `AreaChart` balance trend (P4-03), `DonutChart` + category table
  (P4-02), `RecentTransactions` (P4-04), per-currency balance list, and the
  **empty state** (P4-06) when the user has no accounts or no transactions.
- `app/protected/PeriodSelector.tsx` — client; `SegmentedControl` → router push.
- `app/protected/RecentTransactions.tsx` — server; last ~8 rows via `ListRow` +
  quick-filter links into `/protected/transactions?...`.
- `app/protected/DashboardEmptyState.tsx` — next-action CTAs (add account /
  import) in both languages.
- `app/protected/export/page.tsx` + `app/protected/export/transactions.csv/route.ts`
  + `app/protected/export/data.json/route.ts`.
- i18n: new `dashboard` + `export` namespaces in `messages/{en,es}.json`
  (parity test stays green); nav links for Dashboard + Export.

## Out of scope

- FX / base-currency consolidation (P1-07 follow-up).
- Settings, rule CRUD, uncategorized list (P5-01 / P3-07).
- ZIP of per-entity CSVs — JSON is the full-bundle format; CSV is the ledger.
- Legal "not financial advice" notice → P5-07.

## Verification

`npm run typecheck`, `npm run lint`, `npm test` green. Manual (gate): dashboard
reflects real data across periods; CSV export re-imports cleanly; JSON parses.
