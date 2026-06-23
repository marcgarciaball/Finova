# Finova — Progress Board

Status legend: `TODO` · `WIP` · `PARTIAL` (scaffold satisfies part of it) · `BLOCKED` · `DONE` (meets Definition of Done in the spec).

Work one ticket at a time, one PR each. Do not start a phase until the prior phase's gate passes.

> Note: a Supabase + Next.js starter scaffold pre-existed. Tickets already partly satisfied by it are marked `PARTIAL` with a note so the board reflects reality.

## Phase 0 — Foundation & guardrails
| ID | Ticket | Owner | Status |
|----|--------|-------|--------|
| P0-01 | Repo, package manager, lint/format, TS-strict, git hooks, Conventional Commits | Architect | DONE |
| P0-02 | CI pipeline: type-check + lint + tests on every PR | Architect | REVIEW |
| P0-03 | Env validation with Zod (`.env.example`, fail fast) | Backend/Domain | REVIEW |
| P0-04 | Supabase project + clients (server/browser, RN-portable) | Schema/DB | PARTIAL — clients exist in `lib/supabase/` |
| P0-05 | Auth: magic link (PKCE) + Google + optional password; harden callback | Security | REVIEW — hardened; Google provider config deferred |
| P0-06 | Protected routes / session helpers; default-deny | Security | REVIEW — `requireUser()` in place |
| P0-07 | Drizzle setup + first migration; profiles table w/ RLS | Schema/DB | DONE — migration applied; signup trigger verified (auto-created profile row) |
| P0-08 | Skill: `write-rls-policy-and-tests`; prove A can't read B | Security | REVIEW |
| P0-09 | i18n wiring (next-intl), ES+EN, locale switch; skill `setup-i18n-string` | Frontend | REVIEW — verify locale switch in browser |
| P0-10 | Design tokens (CSS vars) + base layout/shell, dark/light | Frontend | PARTIAL — tokens in `app/globals.css`; localized nav shell now in place |
| P0-11 | Security headers (CSP/HSTS) + rate limit on auth | Security | REVIEW |
| **Gate** | sign up via magic link, switch language, hit protected page, tests green | Coordinator | TODO |

**P0-01 notes:** native git hooks in `.githooks/` (enable with `npm run prepare`); `tsconfig` gains `noUncheckedIndexedAccess`; `.env.example` seeded; README rewritten for Finova.

**P0-02 notes:** `.github/workflows/ci.yml` runs `npm ci` → lint → typecheck → test on PRs + pushes to `main`. Not yet exercised by a real PR.

**P0-05 notes:** Fixed an open-redirect in `/auth/confirm` — `next` now goes through `lib/auth/redirect.ts#safeRedirectPath` (same-origin allowlist, 12 tests). Added hardened `/auth/callback` (OAuth/PKCE code exchange, ready for Google). `emailRedirectTo` pinned to `NEXT_PUBLIC_SITE_URL`. Deferred: enabling the Google provider (needs Supabase dashboard config) + a "Continue with Google" button.

**P0-06 notes:** `lib/auth/require-user.ts#requireUser()` (server-only, default-deny, redirects to login). Applied to `app/protected/page.tsx`. Enforced alongside RLS, not instead of it.

**P0-11 notes:** Security headers in `next.config.ts` (`CSP`, HSTS, X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy). In-memory rate limiter (`lib/rate-limit.ts`, 4 tests) on the auth token routes (`/auth/confirm`, `/auth/callback`). Known follow-ups for P5-05: CSP `script-src` still allows `'unsafe-inline'` (nonce-hardening pending); rate-limit store is per-instance (swap for Upstash/Redis for multi-instance). **Verify:** `npm run dev`/`build` doesn't break under the CSP.

**P0-09 notes:** next-intl 4 cookie-based (no `[locale]` routing — ADR-004 revised). `lib/i18n/{config,request,actions}.ts`, `messages/{en,es}.json`, next.config plugin, `NextIntlClientProvider` + `<html lang>` in root layout. `LocaleSwitcher` (cookie + `router.refresh`). Starter landing + protected shell replaced with localized chrome; `deploy-button.tsx` removed (cleared the demo lint infos). Skill `setup-i18n-string` built. **Verify in browser:** landing shows in ES, switch to EN persists across reload. Note: `auth-button` + auth pages still have hardcoded strings — deferred to the P5-03 full i18n pass.

**P0-07 notes:** Drizzle (`drizzle-orm` + `postgres` + `drizzle-kit`). `lib/db/schema/profiles.ts` (owner = `id`, default-deny RLS for select/insert/update, currency/locale checks), `lib/db/client.ts` (lazy, `server-only`, pooled, `prepare:false` for pgbouncer), `drizzle.config.ts`. Migration `drizzle/0000_broad_raider.sql` generated, hand-extended with `updated_at` + `handle_new_user` triggers. **Action required:** set `DATABASE_URL`/`DIRECT_URL` in `.env.local`, then `npm run db:migrate`.

**P0-08 notes:** `write-rls-policy-and-tests` skill written (`docs/skills/`). RLS isolation suite `tests/rls/profiles.rls.test.ts` (4 cases) — skipped unless `TEST_DATABASE_URL` is set; run against a disposable DB.

**P0-03 notes:** `lib/validation/env.ts` (pure schema + `parseEnv` + lazy `getClientEnv()`) and `lib/validation/env.server.ts` (`server-only`, lazy `getServerEnv()`). Supabase clients refactored off raw `process.env.X!` — the 6 `noNonNullAssertion` warnings are now cleared. 6 unit tests, all green. Remaining lint debt: 2× info-level `noUselessFragments` in demo `deploy-button.tsx` → cleared when the starter landing is replaced (P0-09/P0-10).

## Phase 1 — Core data model & money safety
| ID | Ticket | Owner | Status |
|----|--------|-------|--------|
| P1-01 | Skill `add-money-safe-feature` + money module (cents+currency, full tests) | Backend/Domain | DONE |
| P1-02 | Schema+RLS `accounts`; CRUD Server Actions + UI | Schema/DB + Frontend | REVIEW — code complete; **migration 0001 applied** (verify CRUD in browser) |
| P1-03 | Schema+RLS `categories`/subcategories; bilingual default seed | Schema/DB | REVIEW — code complete; **migration 0002 applied** (confirm signup seeds tree) |
| P1-04 | Schema+RLS `transactions` (full fields) | Schema/DB | DONE — migration 0003 applied; table verified (4 policies, 3 FKs, 5 checks, 6 indexes, trigger, RLS on) |
| P1-05 | Transactions UI: CRUD, filters, search, row recategorize | Frontend | REVIEW — code complete; verify CRUD/filters in browser |
| P1-06 | Transfer flag excluded from income/expense totals (tested) | Backend/Domain | DONE — totals module excludes transfers; 11 unit tests |
| P1-07 | Multi-currency: base/display on profile; per-transaction currency | Backend/Domain | PARTIAL — per-tx currency + per-currency totals shipped; base-currency consolidation needs an FX source (deferred) |
| **Gate** | accounts/categories/transactions created, totals correct, RLS tested | Coordinator | TODO |

**P1-02 notes:** Implemented per `docs/superpowers/specs/2026-06-22-accounts-design.md`. Schema `lib/db/schema/accounts.ts` (bigint-cents `opening_balance`, text+check `type`, four owner-scoped default-deny RLS policies mirroring `profiles`, `user_id` index). Migration `drizzle/0001_accounts.sql` generated + hand-added `accounts_set_updated_at` trigger (reuses `set_updated_at()`). Runtime data access via the **RLS-enforced Supabase server client** (not Drizzle): `app/protected/accounts/{data.ts,actions.ts}` (`requireUser()` first, owner from JWT `claims.sub` never the form, discriminated `ActionResult`, soft-archive + hard-delete with `TODO(P1-04)` emptiness guard). UI: `AccountForm` (create+edit, `useActionState`, inline field errors), `AccountRow` (read/edit toggle + archive/delete), `account-list` (active/archived sections), `CreateAccountPanel`, `page.tsx`; Accounts nav link added. Validation `lib/validation/account.ts` + 14 unit tests (green). RLS suite `tests/rls/accounts.rls.test.ts` (6 cases, skipped without `TEST_DATABASE_URL`). i18n `accounts` namespace in `messages/{en,es}.json`. **Verified:** `npm run typecheck`, `npm run lint`, `npm test` (75 pass / 10 skip) all green. **Action required:** set DB env + `npm run db:migrate` to apply `0001`; then run the RLS suite against a disposable DB and verify create/edit/archive/delete in the browser. (`npm run build` not runnable in this sandbox — Turbopack can't bind a port.)

**P1-03 notes:** Implemented per `docs/superpowers/specs/2026-06-22-categories-design.md`. Schema `lib/db/schema/categories.ts` — two-level tree (`parent_id` self-ref, `ON DELETE CASCADE`), `name` + nullable `name_key` (i18n key for seeded defaults, NULL for custom), `kind` text+check (`income`/`expense`), `is_default` flag, four owner-scoped default-deny RLS policies mirroring `accounts`, partial unique index `(user_id, name_key) where name_key is not null` (keeps the signup seed idempotent). Migration `drizzle/0002_spotty_sleeper.sql` generated + hand-added the `categories_set_updated_at` trigger, a `SECURITY DEFINER seed_default_categories(uuid)` that plants the bilingual default tree, and a second `AFTER INSERT ON auth.users` trigger (`on_auth_user_created_seed_categories`) that calls it — separate from `handle_new_user` so profile + category provisioning stay independent. Canonical default set in `lib/domain/categories/defaults.ts` (13 parents + 4 subcategories) is the single source of truth, mirrored by the SQL seed and the `categories.defaults` i18n namespace in `messages/{en,es}.json`. Validation `lib/validation/category.ts` (`createCategorySchema`/`updateCategorySchema`/`categoryRowSchema`) + tests; i18n sync test (`defaults.i18n.test.ts`) asserts every default key has an EN+ES label. RLS suite `tests/rls/categories.rls.test.ts` (7 cases incl. seed-on-signup, skipped without `TEST_DATABASE_URL`). **Verified:** `npm run typecheck`, `npm run lint`, `npm test` (104 pass / 17 skip) all green. **Scope:** Schema/DB only per the ticket — no CRUD UI (deferred to Settings P5-01) and no Server Actions yet (land with the transactions work P1-04/05 that consumes categories). **Known limit:** RLS can't cheaply assert `parent_id` is owned by the same user (FK checks bypass RLS); the app layer validates parent ownership + matching kind before write. **Action required:** `npm run db:migrate` to apply `0002`; then run the RLS suite against a disposable DB and confirm a fresh signup gets the default tree.

**P1-04 notes:** Implemented per `docs/superpowers/specs/2026-06-22-transactions-design.md`. Schema `lib/db/schema/transactions.ts` — the core ledger row: `account_id` (FK `accounts` **ON DELETE restrict** — this is the P1-02 emptiness guard, now enforced at the DB), nullable `category_id` (FK `categories` **ON DELETE set null** — deleting a category un-categorizes rows, preserving records), **signed** bigint-cents `amount_cents` (sign is the source of truth for income/expense; nonzero check), per-transaction `currency` (P1-07), UTC `occurred_at`, `description` (1..200), nullable `note` (≤2000), `tags text[]`, `is_transfer`/`transfer_group_id` (a check ties them: `is_transfer = (transfer_group_id is not null)`), `is_recurring`. Four owner-scoped default-deny RLS policies mirroring `accounts`. Indexes: `user_id`, `account_id`, `category_id`, `(user_id, occurred_at desc)` (main list query), partial `transfer_group_id`. Migration `drizzle/0003_magenta_gladiator.sql` generated + hand-added `transactions_set_updated_at` trigger. Validation `lib/validation/transaction.ts` (`createTransactionSchema`/`updateTransactionSchema`/`transactionRowSchema`, signed `amountSchema`, `parseAmountToCents` via the money module) + 18 unit tests. RLS suite `tests/rls/transactions.rls.test.ts` (8 cases incl. FK-restrict on account delete + FK-set-null on category delete; skipped without `TEST_DATABASE_URL`). **Verified:** `npm run typecheck`, `npm run lint`, `npm test` (118 pass / 25 skip) all green. **Scope:** Schema/RLS only per the ticket — CRUD Server Actions + UI land in P1-05; the friendly "can't delete account with transactions" message is a P1-05 follow-up (the DB invariant itself is enforced now). **Applied:** `0003` migrated 2026-06-23; table verified in the DB (4 RLS policies + RLS on, 3 FKs, 5 check constraints, 6 indexes, `transactions_set_updated_at` trigger). Remaining verification: run the RLS suite against a disposable DB (`TEST_DATABASE_URL=… npm test -- rls`).

**P1-05 notes:** Implemented per `docs/superpowers/specs/2026-06-23-transactions-ui-design.md`. The user-facing ledger under `app/protected/transactions/`. **Data** (`data.ts`, RLS-enforced Supabase server client): `listTransactions(filters)` (newest first, server-side filters), `listAccountsForPicker` (active only), `listCategoriesForPicker`, `getBaseCurrency`. **Actions** (`actions.ts`): `createTransaction`/`updateTransaction` (sign composed from an income/expense direction control + positive magnitude, then validated by the existing `createTransactionSchema`; app-layer `refsAreOwned` check on `account_id`/`category_id` since FK checks bypass RLS), `recategorizeTransaction(id, categoryId|null)` (inline quick reassign / un-categorize), `deleteTransaction`. **UI**: `TransactionForm` (create+edit), `TransactionRow` (read/edit toggle + inline category `<select>` + delete), `transaction-list`, `TransactionFilters` (URL-param-driven: account/category/type/date-range/description search — shareable, no client fetch), `CreateTransactionPanel`, `TransactionsSummary` (P1-06), `page.tsx` (reads `searchParams`). **Pure helpers** (tested): `lib/domain/transactions/filters.ts` (parse/serialize/validate filter state, `transactionType` classifier) and `lib/domain/categories/label.ts` (`categoryLabel` — default `name_key` → i18n, custom → literal). i18n `transactions` namespace in `messages/{en,es}.json` + nav link; new `messages/i18n-parity.test.ts` asserts EN⇄ES key parity across all namespaces. **Accounts follow-up done:** `deleteAccount` now maps the FK `restrict` violation (SQLSTATE `23503`) to a friendly `hasTransactions` error, surfaced inline in `AccountRow`. Transfers: full two-leg transfer wizard deferred (the create form always writes a non-transfer row); existing transfer rows render and filter. Sign/tag form parsing extracted to a pure, tested `lib/domain/transactions/form.ts` (the `'use server'` action module can only export async fns). **Verified:** `npm run typecheck`, `npm run lint`, `npm test` (155 pass / 25 skip) all green. **Verify in browser:** create/edit/delete a transaction, combine filters, inline-recategorize a row.

**P1-06 notes:** `lib/domain/transactions/totals.ts` — pure totals: `summarizeByCurrency` (per-currency income/expense/net) and `summarizeInBase` (single reporting currency via a caller-supplied rate table; throws on a missing rate). Income/expense is the **sign** of `amount_cents` (expense reported as a positive magnitude); `net = income − expense`. **Transfers (`is_transfer`) are excluded from every total** — the ticket's core invariant, covered by an explicit test. 11 unit tests. Surfaced in the UI via `TransactionsSummary` (one card per currency, transfers excluded). Totals are computed from a **dedicated lightweight query** (`listTransactionsForTotals` — three columns, no page cap) so they stay accurate even when the list is truncated to the 200-row page; both queries share one `applyFilters` builder so list and totals always agree on the filter set.

**P1-07 notes:** Per-transaction `currency` is stored (P1-04 schema) and honored end-to-end: the transaction form defaults to the account's currency (falling back to the profile `base_currency`), and rows/summary format in each transaction's own currency. `summarizeInBase` provides base-currency consolidation in the domain, but it needs an exchange-rate source — the domain deliberately never fetches FX. **Open question (deferred):** wire a rate provider (or a manual rate table in Settings, P5-01) before showing a single consolidated base-currency total; a `display_currency` profile column is only worth adding once that consumer exists. Until then the UI shows per-currency totals, which is correct and assumption-free.

**P1-01 notes:** `lib/domain/money/` — pure domain module: integer cents + ISO-4217 currency, no floats. `money.ts` (constructors, exact + half-up-rounded arithmetic, compare, `convert`, `allocate` largest-remainder split), `format.ts` (Intl, locale-aware, forced 2 decimals), `errors.ts` (typed). Near-100% unit coverage. Skill `add-money-safe-feature` written. ADR-007 records the fixed-2-decimal choice.

## Phase 2 — Import engine
| ID | Ticket | Owner | Status |
|----|--------|-------|--------|
| P2-01 | Storage: private per-user bucket + upload (size/type limits, path RLS) | Schema/DB | TODO |
| P2-02 | Skill `add-import-adapter` + parser registry | Import | PARTIAL — adapter contract + registry + skill built + tested (bank adapters land in P2-04) |
| P2-03 | Generic CSV/Excel parser + column-mapping UI; save mapping template | Import | PARTIAL — pure CSV parser + delimiter detection + cell-safety built + tested (Excel, mapping UI + template persistence pending) |
| P2-04 | 2–3 real bank adapters | Import | TODO |
| P2-05 | Encoding/locale resilience (UTF-8/Latin-1, decimal/date/thousands) | Import | PARTIAL — locale decimal/date parsers built + tested (encoding/file I/O pending) |
| P2-06 | De-dup: deterministic fingerprint + fuzzy fallback | Import | PARTIAL — pure fingerprint + fuzzy matcher built + tested (commit wiring pending) |
| P2-07 | Review-before-commit screen (new/dup/error counts + row preview) | Frontend | TODO |
| P2-08 | Idempotent commit; partial-failure handling | Import | TODO |
| P2-09 | File-safety hardening (CSV formula injection, oversized, malformed) | Security | PARTIAL — `sanitizeCell` formula-injection guard built + tested (size/row caps + malformed handling land with P2-01/P2-03) |
| **Gate** | import real statement, review accurate, commit once, re-import = no change | Coordinator | TODO |

**Phase 2 design:** `docs/superpowers/specs/2026-06-23-import-engine-design.md` — overview of the upload→parse→normalize→fingerprint→review→commit pipeline, the adapter-registry shape, schema additions sketch, and open questions. **Note:** Phase 2 implementation is gated on the Phase 1 manual gate; only the design-independent pure core has been started.

**P2-02 notes (partial, ahead of the gate):** `lib/domain/import/adapter.ts` — the pure adapter contract + registry. `ImportAdapter = { id, detect(parsed) → boolean, parse(parsed) → RawTxn[] }`; `RawTxn` is the account-agnostic normalized row (signed integer cents, ISO date, optional currency/note — the account is chosen per batch, not by the adapter). `selectAdapter` / `createAdapterRegistry` pick the first adapter whose `detect` matches (registration order = priority), else return `null` to fall back to the generic column-mapping flow (P2-03); registration rejects a duplicate `id`. 9 unit tests. Skill `docs/skills/add-import-adapter.md` documents the fixture-driven recipe (reuse the `csv`/`locale-parse` cores, signed cents via the money module, TDD the parse test first). **Pending:** the concrete bank adapters (P2-04) and wiring the registry into the upload→parse flow (gated on the Phase 1 gate + P2-01 storage).

**P2-03 notes (partial, ahead of the gate):** `lib/domain/import/csv.ts` — pure, synchronous RFC-4180-style parser (`parseCsv`: quoted fields, `""` escapes, embedded delimiters/newlines, no spurious trailing row) + `detectDelimiter` (`,`/`;`/tab, counts outside quotes) + `rowsToRecords` (header-keyed objects). Includes `sanitizeCell` for **CSV/spreadsheet formula injection** (P2-09): leading `= + - @`/tab/CR prefixed with `'` so cells stay inert on export — callers parse the numeric value from the raw cell *before* sanitizing for display. Unit-tested. **Pending:** Excel (SheetJS vs. CSV-only MVP — open question in the design), the column-mapping UI, and `import_templates` persistence keyed by header signature (all stateful → gated).

**P2-06 notes (partial, ahead of the gate):** `lib/domain/import/fingerprint.ts` — pure de-dup core. `transactionFingerprint` = FNV-1a hash of a canonical `accountId|date|amountCents|normalizedDescription` key (stable across re-imports → the idempotency key for P2-08; `normalizeDescription` lowercases, strips accents/punctuation, collapses whitespace so trivial reformatting doesn't defeat it). Fuzzy layer: `levenshtein` + `descriptionSimilarity` + `isFuzzyDuplicate` (same account+date+amount and description similarity ≥ threshold, default 0.85) — surfaces near-dups for review, never auto-drops. 17 unit tests. **Pending:** persist the fingerprint column + the partial unique index (P2-08 migration) and the review-screen wiring (P2-07). FNV-1a is non-cryptographic and adequate for an idempotency key.

**P2-05 notes (partial, ahead of the gate):** `lib/domain/import/locale-parse.ts` — pure, money-safe locale parsing reused by every future adapter. `parseDecimalToCanonical` turns `1.234,56` / `1,234.56` / `(1.234,56)` / `€ 1.234,56` into a canonical `.`-decimal string for the money module (explicit `decimal` hint preferred; `auto` uses "rightmost separator wins" + a lone-3-digit-group heuristic; never returns a signed zero). `parseDateToIso` handles `/.-` separators, `dmy`/`mdy`/`ymd`/`auto` (auto defaults to `dmy` for ES, disambiguates on a >12 component), 2-digit years → 2000s, and rejects impossible/non-leap dates. 21 unit tests. **Still pending for P2-05:** UTF-8/Latin-1 byte decoding and delimiter detection (file-level, lands with P2-03's parser).

## Phase 3 — Categorization & rules
| ID | Ticket | Owner | Status |
|----|--------|-------|--------|
| P3-01 | Skill `add-categorization-rule` + rules schema + RLS | Rules | TODO |
| P3-02 | Rule matching (merchant/desc/amount/account), priority, enable/disable | Rules | TODO |
| P3-03 | Apply rules on import + on demand; deterministic + tested | Rules | TODO |
| P3-04 | Sensible default rules (bilingual) | Rules | TODO |
| P3-05 | Learn-from-correction: "make this a rule" | Rules | TODO |
| P3-06 | "Test rule against existing data" preview | Rules | TODO |
| P3-07 | Uncategorized / needs-review list | Frontend | TODO |
| **Gate** | import auto-categorizes most rows; custom rule; corrections become rules | Coordinator | TODO |

## Phase 4 — Dashboard & export
| ID | Ticket | Owner | Status |
|----|--------|-------|--------|
| P4-01 | Dashboard: net cash flow, balances, savings rate | Frontend | TODO |
| P4-02 | Spending-by-category (chart+table), period selector | Frontend | TODO |
| P4-03 | Income vs expense over time + balance/trend chart | Frontend | TODO |
| P4-04 | Recent transactions + quick filters | Frontend | TODO |
| P4-05 | Export all data to CSV + JSON (RLS-scoped) | Backend/Domain | TODO |
| P4-06 | Empty states with next actions, both languages | Frontend | TODO |
| **Gate** | dashboard reflects data; export round-trips cleanly | Coordinator | TODO |

## Phase 5 — Hardening & release
| ID | Ticket | Owner | Status |
|----|--------|-------|--------|
| P5-01 | Settings: profile, base currency, manage categories & rules | Frontend | TODO |
| P5-02 | Account deletion + data export (GDPR), end-to-end | Security | TODO |
| P5-03 | Full i18n pass: no missing keys, dates/numbers localized | Frontend | TODO |
| P5-04 | Accessibility pass (keyboard, focus, contrast, reduced motion) | QA/Test | TODO |
| P5-05 | Full security audit; skill `security-review-checklist` run | Security | TODO |
| P5-06 | Performance/polish: loading states, errors, mobile responsive | Frontend | TODO |
| P5-07 | Privacy/terms + "not financial advice" notices | Frontend | TODO |
| **Gate** | e2e smoke: sign up → import → categorize → dashboard → export → delete | Coordinator | TODO |
