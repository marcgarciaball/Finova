# P1-02 — Accounts: Schema + RLS + CRUD + UI — Design

**Status:** Approved (brainstorming) — 2026-06-22
**Ticket:** P1-02 "Schema+RLS `accounts`; CRUD Server Actions + UI"
**Depends on:** P0-07 (Drizzle + `profiles`), P0-08 (RLS test harness), P1-01 (money module)

## Goal

Let an authenticated user create, view, edit, archive, and delete their own
financial accounts (e.g. a checking account, a credit card). Each account
carries a name, a type, a currency, and an opening balance. Ownership is
enforced at two layers: the application guard (`requireUser()`) and
default-deny RLS in Postgres.

## Decisions (resolved in brainstorming)

- **Data access at runtime:** the **Supabase server client** (RLS-enforced).
  Drizzle is used only for schema definition, migration generation, RLS-as-SQL,
  and type inference — never for user-scoped runtime queries (it connects as the
  DB owner and bypasses RLS; see `lib/db/client.ts`).
- **Account types:** `checking`, `savings`, `cash`, `credit_card`,
  `investment`. `credit_card` is a liability; the rest are assets. Asset/liability
  classification is derived in code (a lookup), not stored.
- **Balance:** store an **opening balance** as integer **cents** + currency
  (via the P1-01 money module). Current/derived balance is out of scope until
  transactions exist (P1-04). Lists display the opening balance for now.
- **Deletion:** **soft archive** (`archived` flag) is the everyday action.
  **Hard delete** is allowed only when an account has no transactions — trivially
  true now (no transactions table), so hard delete is unrestricted today with a
  `TODO(P1-04)` to add the emptiness guard once transactions exist.
- **Typing the Supabase client:** no generated `Database` type. Validate input
  with Zod and **parse DB rows through a Zod row schema** at the boundary, which
  yields the domain `Account` type and keeps us decoupled from remote codegen.
- **Type column:** `text` + `check` constraint (consistent with `profiles`),
  not a Postgres `enum`.

## Architecture

```
app/protected/accounts/
  page.tsx              server: requireUser → fetch accounts → render list
  actions.ts            'use server' CRUD actions (Supabase client, RLS)
  data.ts               server-only read helpers (Supabase client)
  AccountForm.tsx       client: create/edit form (useActionState)
  account-list.tsx      server/presentational: active + archived sections
lib/db/schema/accounts.ts   Drizzle table + RLS policies + inferred types
lib/validation/account.ts   Zod input + row schemas; pure input→cents helper
lib/domain/accounts/types.ts  account-type list, labels key map, asset/liability
messages/{en,es}.json   `accounts` namespace
drizzle/0001_*.sql       generated migration + hand-added updated_at trigger
tests/rls/accounts.rls.test.ts   RLS isolation suite
lib/validation/account.test.ts   schema + input-parse unit tests
```

### Data flow (create)

1. `AccountForm` (client) submits via `useActionState` to `createAccount`.
2. `createAccount` (`'use server'`): `requireUser()` → `createAccountSchema.parse`
   → `fromDecimal(openingBalance)` to cents → insert via Supabase client (RLS
   verifies `user_id = auth.uid()` on `with check`) → `revalidatePath` → return
   discriminated result.
3. `page.tsx` re-renders; `data.ts` reads only the caller's rows (RLS).

## Schema & RLS — `lib/db/schema/accounts.ts`

Mirrors the `profiles` pattern exactly: `(select auth.uid())` owner-equality,
`to: authenticatedRole`, default-deny (RLS enabled, no permissive gaps).

| Column | Type | Constraints / notes |
|---|---|---|
| `id` | `uuid` PK | `default gen_random_uuid()` |
| `user_id` | `uuid` not null | FK → `auth.users(id)` `on delete cascade` |
| `name` | `text` not null | `check`: `char_length(trim(name)) between 1 and 100` |
| `type` | `text` not null | `check in ('checking','savings','cash','credit_card','investment')` |
| `currency` | `text` not null | `check ~ '^[A-Z]{3}$'` |
| `opening_balance` | `bigint` (mode `number`) not null | default `0`; integer **cents**; may be negative |
| `archived` | `boolean` not null | default `false` |
| `created_at` | `timestamptz` not null | `defaultNow()` |
| `updated_at` | `timestamptz` not null | `defaultNow()` + trigger |

`bigint` mode `number` keeps cents as a JS `number` within the money module's
safe-integer range; the postgres-js driver returns `bigint` as a string
otherwise, which would break arithmetic.

**Policies** (four, all `to: authenticatedRole`, owner = `(select auth.uid()) = user_id`):
- `accounts_select_own` — `for: 'select'`, `using`
- `accounts_insert_own` — `for: 'insert'`, `withCheck`
- `accounts_update_own` — `for: 'update'`, `using` + `withCheck`
- `accounts_delete_own` — `for: 'delete'`, `using`

**Index:** `(user_id)` for list queries.

**Trigger:** reuse the existing `public.set_updated_at()` function (already
created in `0000_*.sql`); add an `accounts_set_updated_at BEFORE UPDATE` trigger
in the hand-added section of the generated migration.

```ts
export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert
```

## Validation & domain — `lib/validation/account.ts`, `lib/domain/accounts/types.ts`

`lib/domain/accounts/types.ts`:
```ts
export const ACCOUNT_TYPES = ['checking','savings','cash','credit_card','investment'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]
// liabilities carry balances with the opposite sign meaning; used for future derivations + labels
export const LIABILITY_TYPES = new Set<AccountType>(['credit_card'])
export const isLiability = (t: AccountType) => LIABILITY_TYPES.has(t)
```

`lib/validation/account.ts` (Zod):
- `accountTypeSchema = z.enum(ACCOUNT_TYPES)`
- `currencySchema = z.string().regex(/^[A-Z]{3}$/)`
- `openingBalanceSchema` — a decimal **string** (what the form sends), e.g.
  `"1234.56"`, optional, default `"0"`. The action converts it with the money
  module; the schema only validates it is a well-formed decimal string.
- `createAccountSchema` — `{ name: trimmed 1..100, type, currency, openingBalance }`
- `updateAccountSchema` — same shape (full replace of editable fields).
- `accountRowSchema` — parses a raw Supabase row into a typed `Account`
  (coerces `opening_balance` to number, validates enum/currency). Single source
  of truth for runtime row shape.
- `parseOpeningBalanceToCents(input: string, currency: string): number` — pure,
  uses `fromDecimal` from the money module; unit-tested. The action calls this.

## Server Actions — `app/protected/accounts/actions.ts`

All `'use server'`, all start with `requireUser()`, all use the Supabase server
client. Return type:

```ts
type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
```

- `createAccount(_prev, formData)` — validate → `parseOpeningBalanceToCents`
  → `insert({ user_id: claims.sub, ... })` → `revalidatePath('/protected/accounts')`.
- `updateAccount(_prev, formData)` — reads `id` from form; validate; update
  scoped to `id` (RLS guarantees ownership). Missing/foreign id ⇒ 0 rows ⇒
  `{ ok:false }`.
- `setArchived(id, archived)` — toggles the flag (used by archive/unarchive).
- `deleteAccount(id)` — hard delete via Supabase client.
  `// TODO(P1-04): refuse when the account has transactions.`

Zod errors are mapped to `fieldErrors`; unexpected errors return a generic
message (never leak DB internals). The user `id` always comes from
`claims.sub`, **never** from the form.

## Read helpers — `app/protected/accounts/data.ts`

`server-only`. `listAccounts()` → `requireUser()` → Supabase
`from('accounts').select('*').order('created_at')` → `accountRowSchema.array().parse`.
Returns active and archived in one fetch; the page partitions them.

## UI — `app/protected/accounts/`

- `page.tsx` (server): `requireUser`, `getTranslations('accounts')`, fetch via
  `listAccounts()`, render a "New account" link/button + `account-list`. Basic
  empty state (full polish is P4-06).
- `account-list.tsx` (server/presentational): **Active** section then, if any,
  an **Archived** section. Each row uses the existing `Card`/`Stat` kit: name,
  localized type label, opening balance via `format(money(opening_balance,
  currency), locale)`, an archived `Badge`, and edit/archive/delete affordances
  routing to the form / actions.
- `AccountForm.tsx` (client): one component for create and edit (edit passes an
  existing account; create passes none). Fields: name (`Input`), type
  (`SegmentedControl` or native `select` over `ACCOUNT_TYPES`), currency
  (`Input`, defaulting to the profile's `base_currency`), opening balance
  (`Input`, decimal text). `useActionState` drives inline `fieldErrors`.
- **Nav:** add an **Accounts** link to `app/protected/layout.tsx` (using an
  `accounts.nav` i18n key).

## i18n — `messages/{en,es}.json`

New `accounts` namespace: `title`, `nav`, `new`, `edit`, `archive`,
`unarchive`, `delete`, `empty`, field labels (`name`, `type`, `currency`,
`openingBalance`), validation messages, and `types.{checking,savings,cash,
credit_card,investment}` labels. `es` is the default locale; both files stay
key-for-key in sync.

## Error handling

- **Auth:** `requireUser()` redirects unauthenticated callers (never returns).
- **Validation:** Zod failures → `fieldErrors` rendered inline by the form.
- **Ownership:** enforced by RLS `with check`/`using`; a foreign/missing `id`
  yields 0 affected rows → `{ ok:false }`, not an exception.
- **Unexpected:** caught, logged server-side, returned as a generic error.

## Testing

- `tests/rls/accounts.rls.test.ts` (skipped without `TEST_DATABASE_URL`,
  mirrors `profiles.rls.test.ts`): seed accounts for A and B via the owner
  connection; assert as user A — sees only own rows; cannot select/update/delete
  B's rows; cannot insert a row with `user_id = B`; **can** select/insert/update/
  delete its own.
- `lib/validation/account.test.ts`: enum acceptance/rejection, currency regex,
  name trimming/length bounds, `openingBalance` string validation, and
  `parseOpeningBalanceToCents` (including `"1234.56" → 123456`, `"0"`, negative,
  and rejection of malformed input).
- Server Actions: pure helpers are unit-tested; action wiring is covered by the
  RLS suite plus manual verification (Server Actions are impractical to unit-test
  against the Next runtime in isolation).

## Out of scope (YAGNI)

Account-name uniqueness, color/icon/institution fields, current-balance
derivation (P1-04), multi-user/shared accounts, the transaction-emptiness delete
guard (TODO until P1-04), and empty-state polish (P4-06).
