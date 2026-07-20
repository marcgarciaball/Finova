# P4-02 — Spending by category

Status: approved (2026-06-28)
Ticket: P4-02 — Spending-by-category (chart+table), period selector
Phase: 4 — Dashboard & export

## Goal

Break a set of transactions down into per-category spending for the chart +
table. As with P4-01, this ticket ships the **pure aggregation core**; the
chart, table, and period selector UI land with the Phase 4 dashboard surface
(P4-02 UI / browser-verified). Period filtering is the existing P1-05
`applyFilters` (date range) at the data layer — the core takes whatever rows it
is given.

## Decisions (locked)

1. **Spending = expense = the negative sign** (ADR-007 / P1-06). Income rows do
   not appear in a *spending* breakdown. Each category's total is the positive
   magnitude of its outflows, matching the totals module's `expense`.

2. **Transfers are excluded.** Same invariant as every total — a transfer is not
   spending.

3. **Per currency, never across.** Mirrors `summarizeByCurrency` /
   `accountBalances`: the breakdown is `Record<currency, CategorySpend[]>`. The
   domain never sums EUR + USD.

4. **Uncategorized is a real bucket.** Rows with `category_id === null` aggregate
   under a `categoryId: null` entry so the chart shows "Uncategorized" rather
   than dropping the spend (and pointing the user at P3-07).

5. **Sorted, with share.** Within each currency the entries are sorted by
   `total` descending (largest spend first — chart/table order), and each entry
   carries `share` = its fraction of that currency's total spending (`0..1`,
   `0` when the currency total is `0`) so the UI needn't recompute it.

6. **Label resolution stays in the UI.** The core returns `categoryId` only;
   `categoryLabel` (P1-05) maps id → localized label at render time. The core is
   id-only so it stays React-/i18n-free.

## Architecture — `lib/domain/dashboard/by-category.ts`

```ts
export type CategorizedTxn = {
  amount_cents: number // signed
  category_id: string | null
  currency: string
  is_transfer: boolean
}

export interface CategorySpend {
  categoryId: string | null
  /** Positive magnitude of outflows for this category, in cents. */
  total: number
  /** Number of expense transactions in this category. */
  count: number
  /** Fraction of the currency's total spending (0..1). */
  share: number
}

/** Per-currency expense breakdown by category, sorted by total desc. */
export function spendingByCategory(
  txns: CategorizedTxn[]
): Record<string, CategorySpend[]>
```

Algorithm: filter to non-transfer rows with `amount_cents < 0`; group by
`currency` then by `category_id`; accumulate `|amount_cents|` and a count;
compute each currency's grand total, set `share = total / grand`, then sort
entries by `total` desc (ties broken by `count` desc, then a stable order).

## Tests — `lib/domain/dashboard/by-category.test.ts`

- groups expenses by category within a currency; income rows ignored.
- transfers excluded even when they have a category.
- `null` category aggregates into an uncategorized bucket.
- per-currency separation (EUR vs USD never merged).
- `share` sums to 1 across a currency's entries (within rounding); `0` total ⇒
  `0` shares, no division by zero.
- sorted by `total` descending.
- empty input → `{}`.

## Out of scope

- Chart, table, period-selector UI → P4-02 UI (browser).
- Income-by-category (this ticket is *spending*) — trivial to add later by
  flipping the sign filter if a tile needs it.

## Verification

`npm run typecheck`, `npm run lint`, `npm test` green.
