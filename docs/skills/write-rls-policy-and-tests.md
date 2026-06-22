# Skill: write-rls-policy-and-tests

**Trigger:** any time a new user-owned table is added (every Phase 1+ data table). RLS is the security backbone — no user table ships without it.

**Goal:** a default-deny, ownership-scoped policy set + a test proving user A cannot touch user B's rows.

## Steps

1. **Ownership column.** Every user table has a non-null owner key — usually `user_id uuid references auth.users(id) on delete cascade` (for `profiles` the owner key *is* the primary key `id`).
2. **Enable RLS.** In the Drizzle schema, attaching any `pgPolicy` enables RLS automatically; otherwise call `.enableRLS()`. RLS enabled with **no** policy = deny all (a safe default).
3. **Write one policy per operation** (`select`, `insert`, `update`, `delete`) scoped `to: authenticatedRole`. Only add `delete` if the table is user-deletable.
   - `using` (read/update/delete visibility): `(select auth.uid()) = <owner col>`
   - `withCheck` (insert/update writes): `(select auth.uid()) = <owner col>`
   - Always wrap as `(select auth.uid())` — Postgres caches it per statement (Supabase perf guidance).
4. **Constraints belong here too.** Add `check()` constraints for enums/formats (e.g. currency `~ '^[A-Z]{3}$'`) — RLS controls *who*, checks control *what*.
5. **Generate + hand-finish.** `npm run db:generate`. Drizzle emits the table, RLS, FK, checks, and policies. Append anything it can't model (triggers, `SECURITY DEFINER` functions) below a `--> statement-breakpoint`, schema-qualified, with `set search_path = ''`.
6. **Test isolation** (see `tests/rls/*.rls.test.ts`): seed two users' rows via the owner connection (bypasses RLS), then run queries under each simulated user (`set local role authenticated` + `set local request.jwt.claims '{"sub": "<uid>"}'`) and assert each sees only their own rows and cannot insert/update for the other.
7. **App-layer auth too.** RLS is the backstop, not the only gate — Server Actions still authorize the caller (`requireUser()`, P0-06) before querying. Belt and suspenders.

## Checklist (maps to Definition of Done)

- [ ] Ownership column present, `not null`, FK to `auth.users` with `on delete cascade`.
- [ ] RLS enabled; a policy exists for every operation the app performs.
- [ ] Policies scoped to `authenticatedRole`, owner-equality on both `using` and `withCheck`.
- [ ] No `delete` policy unless the table is intentionally user-deletable.
- [ ] Format/enum `check` constraints added.
- [ ] RLS isolation test: A cannot read/insert/update/delete B's rows; A can do all four on its own.
- [ ] Migration generated, hand-added SQL reviewed, applied to Supabase.

## Run the tests

```bash
# against a disposable Postgres (local Supabase or a test branch), NOT prod:
TEST_DATABASE_URL="postgresql://...:5432/postgres" npm test -- rls
```
Without `TEST_DATABASE_URL` the RLS suite is skipped (so unit CI stays DB-free); wire a Postgres service into CI to run it there.
