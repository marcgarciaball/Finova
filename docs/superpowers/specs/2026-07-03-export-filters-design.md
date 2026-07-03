# Export filters — design

**Date:** 2026-07-03
**Status:** Approved
**Surface:** Datos screen → Export tab (`app/protected/export/ExportPanel.tsx` + sibling route handlers)

## Goal

Let the user choose *what* to export before downloading: a date range (presets +
custom from/to), a single category, and a single account. Filters apply to both
the CSV ledger and the JSON bundle. In the JSON bundle, accounts and categories
are always exported in full so transaction references resolve; only the
transactions array is filtered.

## Decisions (from brainstorming)

- Filters apply to **both** CSV and JSON exports.
- Date range: **presets + custom** — All time (default), This month, Last 3
  months, This year, plus two date inputs for a custom from/to.
- Category and account: **single-select** dropdowns ("All categories" /
  "Uncategorized" / one category; "All accounts" / one account).
- **One shared filter bar** above both download cards; both buttons respect it.
- Chosen approach: **reuse the transactions filter domain end-to-end** (URL
  query params + `parseFilters` + shared `applyFilters`), rather than in-memory
  filtering or a server-action POST.

## Architecture

### 1. Shared filter domain

Hoist the `applyFilters` PostgREST query-builder from
`app/protected/transactions/data.ts` into `lib/domain/transactions/` (next to
`filters.ts`), preserving its loose-typing note. Both the transactions list and
the export read layer call it, so "matching" always means the same thing:
inclusive date bounds (`from` at 00:00:00Z, `to` at 23:59:59.999Z),
`UNCATEGORIZED` sentinel (`category=none` → `category_id IS NULL`), UUID
validation, `%_` escaping for the text search.

The export UI only surfaces account / category / from / to, but the routes
reuse `parseFilters` wholesale — `type` and `q` params would also work if
passed. That is free consistency, not new scope.

### 2. Export read layer (`app/protected/export/data.ts`)

`getExportData(filters: TransactionFilters)` applies the filters to the
**transactions query only**. Accounts and categories are always fetched in
full. Ordering and zod validation unchanged.

### 3. Route handlers

`transactions.csv/route.ts` and `data.json/route.ts`:

- Build filters with `parseFilters` over the request URL's search params
  (`from`, `to`, `account`, `category`, same names as the transactions page).
- Invalid values (bad UUID, malformed date) are silently dropped by
  `parseFilters` — same forgiving behavior as the transactions page. No new
  error responses.
- When any filter is active:
  - the filename gains a `-filtered` suffix
    (e.g. `finova-transactions-2026-07-03-filtered.csv`);
  - the JSON bundle's `meta` gains a `filters` object recording only the
    active keys. `buildJsonBundle` gets an optional `filters` option;
    existing behavior when absent is unchanged.

### 4. UI

New client component `ExportFilters` rendered by `ExportPanel` above the two
cards. `ExportPanel` stays a server component; it fetches the account and
category lists (same RLS-scoped reads the transactions page uses) and passes
them down.

Controls:

- Preset pills: **All time** (default) / **This month** / **Last 3 months** /
  **This year**. Selecting a pill fills from/to. Definitions (local time,
  `to` = today in all cases): *All time* = no from/to params; *This month* =
  from the 1st of the current month; *Last 3 months* = from the 1st of the
  month two months before the current one (three calendar months including the
  current); *This year* = from January 1st.
- Two date inputs for custom from/to. Editing a date deselects the pills
  (implicit "custom" — no pill highlighted).
- Category select: "All categories", "Uncategorized", then the user's
  categories.
- Account select: "All accounts", then the user's accounts.

State is plain `useState`, transient per visit — no URL-state syncing on the
Datos page. The component computes the query string; both download anchors
receive it in their `href`. Preset date math lives in a small pure helper that
takes "today" as an argument (testable with a fixed date).

Copy: the export description gains a line noting that when filters are active,
the JSON export still includes all accounts and categories but only matching
transactions. New `en`/`es` keys under `export.filters`.

### 5. Error handling

Nothing new: auth already enforced via `requireUser`; bad params degrade to
"no filter"; an empty result set exports as an empty (still valid) ledger or
bundle.

## Testing

- `applyFilters` unit coverage moves with the hoisted module (already exists
  via transactions tests).
- New unit tests: `buildJsonBundle` `meta.filters` (present when given, absent
  otherwise); preset date-range helper against a fixed "today".
- Component test: `ExportFilters` updates both anchors' `href`s as filters
  change.
- Route-level behavior verified by exercising the running app.

## Out of scope

- Multi-select categories/accounts.
- Filtering accounts/categories out of the JSON bundle.
- Persisting filter state in the page URL.
