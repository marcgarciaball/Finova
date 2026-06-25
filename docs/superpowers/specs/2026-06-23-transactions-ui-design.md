# P1-05 — Transactions UI: CRUD, filters, search, recategorize — Design

**Status:** Approved (design, self-directed) — 2026-06-23
**Ticket:** P1-05 "Transactions UI: CRUD, filters, search, row recategorize"
**Depends on:** P1-04 (`transactions` schema + RLS), P1-02 (`accounts`), P1-03 (`categories`), P1-01 (money)

## Goal

The user-facing ledger. List the current user's transactions (newest first),
create / edit / delete them, filter and free-text search, and recategorize a row
inline. All data access through the **RLS-enforced Supabase server client** (never
Drizzle), `requireUser()` first, owner derived from the JWT `sub` — same rules as
P1-02/P1-03.

## Scope decisions

- **Signed amount via a direction control.** The DB stores a signed
  `amount_cents` (`+` income, `−` expense). The form shows an income/expense
  segmented control + a positive magnitude; the action composes the signed
  decimal string and validates it with the existing `createTransactionSchema`
  (schema unchanged — it already accepts a signed decimal). Zero is rejected.
- **Transfers are out of scope for the create form.** P1-04 keeps `is_transfer`
  a flag with a two-leg invariant (`is_transfer = (transfer_group_id is not
  null)`). A full two-leg transfer wizard is deferred (noted on the board); the
  create/edit form always writes a non-transfer row. Existing transfer rows
  (e.g. from import, P2) still render and can be filtered.
- **Inline recategorize.** Each row has a category `<select>` that calls a
  dedicated `recategorizeTransaction(id, categoryId|null)` action — quick
  reassignment without opening the full edit form. Choosing the blank option
  un-categorizes (sets `category_id` null).
- **Filters & search via URL search params.** The page is a server component
  reading `searchParams`; the filter bar is a client component that pushes params
  with the router. Filters: account, category (incl. "uncategorized"), type
  (income / expense / transfer), date from/to, and a description text search
  (`ilike`). Shareable, back-button friendly, no client fetching.
- **Category display name.** Default categories carry an i18n `name_key`
  (`categories.defaults.<key>`); custom categories use their literal `name`.
  Resolved at render via a small `categoryLabel(cat, t)` helper.
- **Currency.** Defaults to the account's currency in the form (falls back to the
  profile base currency). Per-transaction currency is honored for display; true
  multi-currency conversion is P1-07.

## Artifacts

```
app/protected/transactions/data.ts                 list + filters, account/category selects, base currency
app/protected/transactions/actions.ts              create/update/delete/recategorize
app/protected/transactions/TransactionForm.tsx     create+edit (client)
app/protected/transactions/TransactionRow.tsx      read/edit toggle + inline recategorize + delete
app/protected/transactions/transaction-list.tsx    grouped list (server)
app/protected/transactions/TransactionFilters.tsx  filter/search bar (client, URL params)
app/protected/transactions/CreateTransactionPanel.tsx
app/protected/transactions/page.tsx                server page, reads searchParams
lib/domain/transactions/filters.ts                 filter parse/normalize + type helpers (pure, tested)
lib/domain/transactions/filters.test.ts
lib/domain/categories/label.ts                      categoryLabel helper (pure, tested)
messages/{en,es}.json                               transactions namespace
app/protected/layout.tsx                            nav link
app/protected/accounts/actions.ts                   friendly "account has transactions" delete error
```

## Definition of Done

- Create / edit / delete a transaction; list shows newest first with signed,
  locale-formatted amounts (income positive, expense negative).
- Filter by account / category / type / date range and search description; all
  via URL params; combining filters narrows correctly.
- Inline recategorize updates a row's category (incl. un-categorize).
- Deleting an account that still has transactions shows a friendly error
  (FK `restrict` surfaced), not a generic failure.
- `typecheck` / `lint` / `test` all green; new pure helpers unit-tested.
