# P1-04 — Transactions: Schema + RLS — Design

**Status:** Approved (design) — 2026-06-22
**Ticket:** P1-04 "Schema+RLS `transactions` (full fields)"
**Depends on:** P0-07 (Drizzle + `profiles`), P0-08 (RLS test harness), P1-01 (money module), P1-02 (`accounts`), P1-03 (`categories`)

## Goal

Add the `transactions` table — the core ledger row — with default-deny RLS,
following the field list fixed in the MVP design. **Schema + RLS only.** No
Server Actions and no UI: those land in P1-05 (Transactions UI), which consumes
this table. This mirrors how P1-03 (`categories`) was delivered schema-first.

## Fields (from the MVP design)

`id, user_id, account_id, category_id?, amount_cents bigint, currency,
occurred_at (UTC), description, note?, tags[], is_transfer, transfer_group_id?,
is_recurring`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid NOT NULL | FK → `auth.users` ON DELETE **cascade** (owner; same as every table) |
| `account_id` | uuid NOT NULL | FK → `accounts` ON DELETE **restrict** |
| `category_id` | uuid NULL | FK → `categories` ON DELETE **set null** |
| `amount_cents` | bigint (mode `number`) NOT NULL | **signed** integer minor units (ADR-007); `+` inflow, `−` outflow |
| `currency` | text NOT NULL | ISO-4217, `^[A-Z]{3}$` check (per-transaction, supports P1-07) |
| `occurred_at` | timestamptz NOT NULL | stored UTC |
| `description` | text NOT NULL | 1..200 chars |
| `note` | text NULL | ≤ 2000 chars when present |
| `tags` | text[] NOT NULL default `'{}'` | free-form labels |
| `is_transfer` | boolean NOT NULL default false | excluded from income/expense totals (P1-06) |
| `transfer_group_id` | uuid NULL | links the two legs of a transfer; **no FK** (a shared grouping token, not a row reference) |
| `is_recurring` | boolean NOT NULL default false | flag only; recurrence engine is out of scope |
| `created_at` / `updated_at` | timestamptz | `updated_at` kept fresh by trigger |

## Decisions (resolved in design)

- **Signed amount, no `kind` column.** Income/expense is the **sign** of
  `amount_cents` (`+` inflow, `−` outflow); the category's `kind` is descriptive,
  not the source of truth for totals. This keeps P1-06 totals a simple
  `sum(amount_cents) where not is_transfer` split by sign. A
  `transactions_amount_nonzero_check` forbids a zero-value row.
- **`account_id` ON DELETE `restrict`.** A transaction must belong to an
  account, and deleting an account that still has transactions is blocked at the
  DB. This *is* the P1-02 "emptiness guard" the accounts hard-delete left as a
  `TODO(P1-04)` — now enforced by the FK. (Surfacing a friendly error in the
  accounts delete action is a small UI follow-up for P1-05, noted on the board;
  the DB invariant itself is complete here.)
- **`category_id` ON DELETE `set null`.** Deleting a category un-categorizes its
  transactions rather than destroying financial records. `category_id` is
  therefore nullable (an uncategorized transaction is valid — see P3-07).
- **Transfer invariant.** A check constraint ties the flag and the group token
  together: `is_transfer = (transfer_group_id is not null)`. Both legs of a
  transfer share one `transfer_group_id` and carry `is_transfer = true`;
  non-transfers have neither.
- **Per-transaction currency.** Stored independently of the account's currency
  to support multi-currency (P1-07). No cross-column equality is enforced.
- **`tags` as `text[]`.** Matches the MVP field list; simpler than a join table
  and adequate for free-form labels at single-user scale.
- **RLS owner check only.** Four owner-scoped default-deny policies mirroring
  `accounts`/`categories`. As with `categories.parent_id`, RLS cannot cheaply
  assert that `account_id`/`category_id` belong to the same user (FK checks
  bypass RLS), so the app layer (P1-05 actions) validates that the referenced
  account and category are owned by the caller before writing.
- **Data access at runtime (for P1-05):** the RLS-enforced Supabase server
  client, never Drizzle (which connects as owner and bypasses RLS) — same rule
  as P1-02/P1-03.

## Indexes

- `transactions_user_id_idx` on `(user_id)` — ownership.
- `transactions_account_id_idx` on `(account_id)` — per-account views, FK lookups.
- `transactions_category_id_idx` on `(category_id)` — spending-by-category.
- `transactions_user_occurred_idx` on `(user_id, occurred_at desc)` — the main
  list query (a user's transactions, newest first, date-filtered).
- partial `transactions_transfer_group_idx` on `(transfer_group_id)`
  `where transfer_group_id is not null` — pairing the two legs of a transfer.

## Artifacts

```
lib/db/schema/transactions.ts        Drizzle table + RLS policies + inferred types
lib/db/schema/index.ts               barrel: re-export transactions
lib/validation/transaction.ts        Zod input + row schemas; amount→cents helper
lib/validation/transaction.test.ts   schema + input-parse unit tests
drizzle/0003_*.sql                   generated migration + hand-added updated_at trigger
tests/rls/transactions.rls.test.ts   RLS isolation suite (skipped without TEST_DATABASE_URL)
```

## Definition of Done

- Schema + migration generated; `npm run db:migrate` applies `0003` cleanly.
- Four default-deny RLS policies; isolation suite proves A cannot read/write B's
  transactions and that owner CRUD works.
- Validation schemas + unit tests green; `typecheck`/`lint`/`test` all green.
- Deleting an account with transactions is blocked (FK `restrict`); deleting a
  category nulls its transactions' `category_id`.
