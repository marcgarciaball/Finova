# P5-02 — Self-service account deletion & data export (CSV)

**Date:** 2026-06-22
**Status:** Approved design, pending implementation plan
**Scope note:** This is the concrete, shippable implementation of PROGRESS.md item
**P5-02** ("Account deletion + data export (GDPR), end-to-end"). A broader/global
settings design may follow later; this spec stays focused on the two controls a
logged-in user needs today: *export my data* and *delete my account*.

## Goal

A logged-in user can, on their own, from the UI:

1. **Export their data** as a CSV download (synchronous, on demand).
2. **Permanently delete their account**, behind a typed-confirmation gate, with
   their data removed by cascade.

## Decisions (from brainstorming)

| Question | Decision |
|----------|----------|
| Scope | Deletion **and** export (full P5-02) |
| Delete mechanism | `SECURITY DEFINER` Postgres RPC `delete_own_account()` — no service-role key |
| Export format | CSV, generated server-side, downloaded on demand |
| Delete confirmation | User types the literal token `DELETE` before the button enables |
| Location | New `/protected/settings` page with a "Danger zone" section |

## Architecture

```
app/protected/settings/page.tsx          Server component (guarded by protected layout); renders Danger zone
app/protected/settings/_components/
  ├─ export-data-button.tsx               Client: triggers the CSV export download
  └─ delete-account-dialog.tsx            Client: typed-"DELETE" gate → calls deleteAccount() action
app/protected/settings/actions.ts         'use server' — deleteAccount()
app/protected/settings/export/route.ts    GET route handler → CSV file download
lib/export/csv.ts                          Pure helpers: rows[] → RFC-4180 CSV text
drizzle/0001_delete_own_account.sql        Hand-added migration: the RPC (+ journal entry)
lib/db/schema/*                            (no table changes; comment in profiles.ts already anticipates this)
messages/{es,en}.json                      New i18n keys under `settings.*`
```

The protected nav (in `app/protected/layout.tsx`) gains a link to `/protected/settings`.

## Component 1 — `delete_own_account()` RPC (database)

A `SECURITY DEFINER` function, owned by a role able to delete from `auth.users`,
that deletes **only the caller's own** auth user. The existing FK
`profiles.id → auth.users.id ON DELETE CASCADE` (and every future user-owned
table that FKs the same way) cleans up application data automatically.

```sql
-- drizzle/0001_delete_own_account.sql
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
```

Notes:
- Mirrors the project's existing `handle_new_user()` convention: `SECURITY
  DEFINER` + `SET search_path = ''` + schema-qualified names.
- The function derives the target from `auth.uid()` itself — a caller **cannot**
  pass another user's id, so this is safe to expose to `authenticated`.
- It's hand-added (Drizzle's schema can't express functions), so the migration is
  written by hand and registered in `drizzle/meta/_journal.json`, matching how
  `handle_new_user()` was added.

## Component 2 — `deleteAccount()` server action

```
app/protected/settings/actions.ts   ('use server')
```

1. `createClient()` (server) → `auth.getClaims()`; if no user, return an error
   (defense in depth — the page is already behind the protected layout).
2. `await supabase.rpc('delete_own_account')`. The browser sent the user's JWT,
   so `auth.uid()` inside the function resolves to them.
3. On error → return `{ error }` so the dialog can surface it; session is kept.
4. On success → `await supabase.auth.signOut()` (clears the SSR cookies) →
   `redirect('/')`.

Why a server action rather than calling `rpc` from the browser: it keeps session
teardown (`signOut`) and the post-delete redirect on the server, and matches the
app's preference for authorizing on the server before mutating.

## Component 3 — CSV export route

```
app/protected/settings/export/route.ts   GET
```

1. `createClient()` (server) → `auth.getClaims()`; 401 if unauthenticated.
2. Read the user's own rows **through the Supabase client** so RLS applies (it
   only ever returns their data) — not the RLS-bypassing Drizzle `getDb()`.
   Today that's the single `profiles` row.
3. Serialize via `lib/export/csv.ts` and return a `Response` with:
   - `Content-Type: text/csv; charset=utf-8`
   - `Content-Disposition: attachment; filename="finova-export-<date>.csv"`

**Extensibility:** `lib/export/csv.ts` exposes a pure `toCsv(rows)` (RFC-4180:
quote fields containing `,"`/newlines, double embedded quotes). The route builds
its dataset from a small list of `{ table, query }` descriptors. Today the list
has one entry (`profiles`). When future tables (accounts, transactions…) land,
they're added to that list; if multiple tables must ship together, the route
upgrades to a ZIP of per-table CSVs. Designed for that, not built for it yet
(YAGNI).

## Component 4 — UI

- **`/protected/settings` page** (server component): a "Danger zone" card with the
  two actions and short explanatory copy. Guarded by the existing protected
  layout — no new auth guard needed.
- **`ExportDataButton`** (client): triggers a download of the export route
  (anchor/`fetch`→blob), with a pending state.
- **`DeleteAccountDialog`** (client): a dialog explaining the action is
  permanent; a text input that must equal the literal token `DELETE` before the
  destructive button enables; calls `deleteAccount()`; shows a returned error
  inline; on success the action redirects.
- **Confirmation token:** the typed word is the fixed, locale-independent string
  `DELETE`. Only the surrounding instruction text is localized (e.g. *"Type
  DELETE to confirm"* / *"Escribe DELETE para confirmar"*), which sidesteps
  per-locale magic-word handling.

## Validation

A small Zod schema validates the dialog input equals `DELETE` (the button-enable
gate is the primary UX; the schema is the belt-and-suspenders check before the
action runs). Follows the existing `lib/validation/` Zod conventions.

## i18n

Add a `settings` namespace to both `messages/es.json` and `messages/en.json`
(locales are `es` default, `en`), covering: page/section titles, export button +
helper text, delete button, dialog title/body/warning, the "type DELETE"
instruction, and error messages. Spanish is authored as the source of truth
(app default), English alongside.

## Testing

Built on the existing Vitest setup and the `tests/rls/` Postgres harness
(`asUser` sets `role=authenticated` + JWT `sub`).

1. **RPC isolation (integration, `tests/rls/`):**
   - As user A, calling `delete_own_account()` deletes A's `auth.users` row and
     cascades A's `profiles` row.
   - It never affects user B (A's call leaves B intact).
   - `anon` cannot execute the function (permission denied).
   - Skipped unless `TEST_DATABASE_URL` is set, like the existing RLS suite.
2. **CSV serializer (unit):** `toCsv` quoting/escaping for commas, quotes,
   newlines, empty/null fields, and header generation.
3. **Export route (unit/integration):** returns the caller's row(s) only, with
   correct `Content-Type`/`Content-Disposition`; 401 when unauthenticated.
4. **deleteAccount action (unit):** returns an error (no redirect/sign-out) when
   the RPC fails; signs out and redirects on success (Supabase client mocked).

## Error handling & edge cases

- **RPC failure** → action returns `{ error }`; dialog shows it; session intact;
  user can retry.
- **Export failure** → route returns a non-200; button shows an error state.
- **Post-delete navigation** → `signOut()` clears cookies; `redirect('/')`. The
  session-refresh middleware (`lib/supabase/proxy.ts`) then sees no session on
  subsequent requests.
- **Re-auth freshness** → not required; the RPC acts on the current JWT and the
  typed-`DELETE` gate is the friction. (A recent-login requirement is out of
  scope.)

## Out of scope

- GDPR data **export delivery** by email / async jobs (chose on-demand).
- A general settings framework beyond the Danger zone (a later global design).
- Service-role admin deletion path (chose the RPC).
- Soft-delete / grace-period / account recovery.

## Affected files (summary)

**New:** `app/protected/settings/page.tsx`,
`app/protected/settings/actions.ts`,
`app/protected/settings/export/route.ts`,
`app/protected/settings/_components/export-data-button.tsx`,
`app/protected/settings/_components/delete-account-dialog.tsx`,
`lib/export/csv.ts`,
`drizzle/0001_delete_own_account.sql`,
tests under `tests/`.

**Modified:** `app/protected/layout.tsx` (nav link),
`messages/es.json`, `messages/en.json`,
`drizzle/meta/_journal.json` (register migration),
`PROGRESS.md` (P5-02 status).
