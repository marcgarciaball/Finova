# P1-03 — Categories & Subcategories: Schema + RLS + Bilingual Seed — Design

**Status:** Approved (brainstorming) — 2026-06-22
**Ticket:** P1-03 "Schema+RLS `categories`/subcategories; bilingual default seed"
**Depends on:** P0-07 (Drizzle + `profiles` + triggers), P0-08 (RLS test harness), P1-02 (accounts pattern)

## Goal

Give every user a private, two-level category tree (parent categories with
optional subcategories) to classify transactions (P1-04+). Each user starts
with a sensible **bilingual** default set, seeded automatically on signup, and
can add/edit/remove their own. Ownership is enforced at two layers:
`requireUser()` and default-deny RLS — identical to `accounts`.

This ticket is **Schema/DB only**: table, RLS, validation, the seed mechanism,
i18n strings for the defaults, and an RLS isolation suite. CRUD UI is deferred
to Settings (P5-01); Server Actions land with the transactions work that
consumes categories.

## Decisions (resolved in brainstorming)

- **Naming / i18n — `name` + nullable `name_key`.** User-created categories
  store a literal `name` (whatever the user typed, one language) and
  `name_key = NULL`. Default (seeded) categories store a stable `name_key`
  (e.g. `groceries`) plus an English `name` fallback; the UI renders
  `t('categories.defaults.<name_key>')` when `name_key` is set, else the literal
  `name`. This is what makes the default set bilingual without translating
  user data. The MVP design lists only `name_key`; we keep `name` too so custom
  categories and the fallback path work.
- **Two levels only.** `parent_id` self-references `categories.id`. A category
  with a non-null `parent_id` is a subcategory; subcategories cannot themselves
  have children. The one-level limit is enforced in the app/validation layer
  (a DB trigger is overkill here) and documented.
- **Kind matches parent.** `kind` is `income` | `expense` (`text` + check, like
  `accounts.type`). A subcategory must share its parent's `kind`; enforced in
  the app layer (the seed guarantees it for defaults).
- **Deletion.** Hard delete. `parent_id` FK is `ON DELETE CASCADE`, so deleting
  a parent removes its subcategories. Once transactions exist (P1-04) we add a
  guard / re-assignment step; `TODO(P1-04)` marks it.
- **Seeding via trigger.** A dedicated `SECURITY DEFINER`
  `public.seed_default_categories(uuid)` inserts the default tree, invoked by a
  second `AFTER INSERT ON auth.users` trigger (separate from `handle_new_user`
  so profile and category provisioning stay independent). Idempotent via
  `ON CONFLICT DO NOTHING` on `(user_id, name_key)`.
- **`is_default` flag.** Marks seeded rows so Settings can treat them specially
  (e.g. "reset to defaults", or warn before deleting). Users may still edit or
  delete them.
- **Data access at runtime:** RLS-enforced Supabase server client (same as
  accounts). Drizzle is schema/migration/types only.
- **Row typing:** no generated `Database` type — parse Supabase rows through a
  Zod `categoryRowSchema` at the boundary.

## Schema (`lib/db/schema/categories.ts`)

| column | type | notes |
|--------|------|-------|
| `id` | uuid pk | `gen_random_uuid()` |
| `user_id` | uuid notNull | → `auth.users` ON DELETE CASCADE |
| `parent_id` | uuid null | → `categories.id` ON DELETE CASCADE (self-ref) |
| `name` | text notNull | literal / English fallback, 1..100 |
| `name_key` | text null | i18n key for defaults; NULL for custom |
| `kind` | text notNull | check in (`income`,`expense`) |
| `is_default` | boolean notNull default false | seeded rows |
| `created_at` / `updated_at` | timestamptz | `set_updated_at()` trigger |

Constraints: `name` length 1..100; `kind` check; partial unique index
`(user_id, name_key) where name_key is not null` (keeps the seed idempotent and
default keys unique per user). Index on `user_id`; index on `parent_id`.

RLS: four owner-scoped default-deny policies (`select`/`insert`/`update`/
`delete`) using `(select auth.uid()) = user_id`, mirroring `accounts`.

> **Known limit:** RLS cannot cheaply assert that `parent_id` points at a row
> the same user owns (FK checks bypass RLS). The app layer validates parent
> ownership + kind before insert/update. A foreign `parent_id` leaks nothing
> readable (the parent row stays hidden by select RLS). Documented; revisit if
> we ever expose category writes without the app guard.

## Default set (bilingual)

Canonical list lives in `lib/domain/categories/defaults.ts` (used for i18n key
generation + tests); the SQL seed mirrors it. Expense parents: housing
(rent, mortgage), food (groceries, restaurants), transport, utilities, health,
shopping, entertainment, education, travel, other_expense. Income parents:
salary, gifts, other_income. Each `name_key` has `en` + `es` strings under
`categories.defaults` in `messages/{en,es}.json`.

## Definition of Done

- Migration `0002_categories` generated, hand-extended with the `updated_at`
  trigger + `seed_default_categories` function + signup trigger.
- `categoryRowSchema` + input schemas + unit tests green.
- i18n keys present in both locales for every default `name_key`.
- RLS suite `tests/rls/categories.rls.test.ts` (A can't see/mutate B; seed
  populates on user insert) — skipped without `TEST_DATABASE_URL`.
- `npm run typecheck && npm run lint && npm test` green.
- **Action required (operator):** `npm run db:migrate` to apply `0002`, then run
  the RLS suite against a disposable DB.
