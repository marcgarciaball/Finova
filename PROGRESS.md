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
| P1-02 | Schema+RLS `accounts`; CRUD Server Actions + UI | Schema/DB + Frontend | REVIEW — code complete; **migration not yet applied** |
| P1-03 | Schema+RLS `categories`/subcategories; bilingual default seed | Schema/DB | REVIEW — code complete; **migration not yet applied** |
| P1-04 | Schema+RLS `transactions` (full fields) | Schema/DB | TODO |
| P1-05 | Transactions UI: CRUD, filters, search, row recategorize | Frontend | TODO |
| P1-06 | Transfer flag excluded from income/expense totals (tested) | Backend/Domain | TODO |
| P1-07 | Multi-currency: base/display on profile; per-transaction currency | Backend/Domain | TODO |
| **Gate** | accounts/categories/transactions created, totals correct, RLS tested | Coordinator | TODO |

**P1-02 notes:** Implemented per `docs/superpowers/specs/2026-06-22-accounts-design.md`. Schema `lib/db/schema/accounts.ts` (bigint-cents `opening_balance`, text+check `type`, four owner-scoped default-deny RLS policies mirroring `profiles`, `user_id` index). Migration `drizzle/0001_accounts.sql` generated + hand-added `accounts_set_updated_at` trigger (reuses `set_updated_at()`). Runtime data access via the **RLS-enforced Supabase server client** (not Drizzle): `app/protected/accounts/{data.ts,actions.ts}` (`requireUser()` first, owner from JWT `claims.sub` never the form, discriminated `ActionResult`, soft-archive + hard-delete with `TODO(P1-04)` emptiness guard). UI: `AccountForm` (create+edit, `useActionState`, inline field errors), `AccountRow` (read/edit toggle + archive/delete), `account-list` (active/archived sections), `CreateAccountPanel`, `page.tsx`; Accounts nav link added. Validation `lib/validation/account.ts` + 14 unit tests (green). RLS suite `tests/rls/accounts.rls.test.ts` (6 cases, skipped without `TEST_DATABASE_URL`). i18n `accounts` namespace in `messages/{en,es}.json`. **Verified:** `npm run typecheck`, `npm run lint`, `npm test` (75 pass / 10 skip) all green. **Action required:** set DB env + `npm run db:migrate` to apply `0001`; then run the RLS suite against a disposable DB and verify create/edit/archive/delete in the browser. (`npm run build` not runnable in this sandbox — Turbopack can't bind a port.)

**P1-03 notes:** Implemented per `docs/superpowers/specs/2026-06-22-categories-design.md`. Schema `lib/db/schema/categories.ts` — two-level tree (`parent_id` self-ref, `ON DELETE CASCADE`), `name` + nullable `name_key` (i18n key for seeded defaults, NULL for custom), `kind` text+check (`income`/`expense`), `is_default` flag, four owner-scoped default-deny RLS policies mirroring `accounts`, partial unique index `(user_id, name_key) where name_key is not null` (keeps the signup seed idempotent). Migration `drizzle/0002_spotty_sleeper.sql` generated + hand-added the `categories_set_updated_at` trigger, a `SECURITY DEFINER seed_default_categories(uuid)` that plants the bilingual default tree, and a second `AFTER INSERT ON auth.users` trigger (`on_auth_user_created_seed_categories`) that calls it — separate from `handle_new_user` so profile + category provisioning stay independent. Canonical default set in `lib/domain/categories/defaults.ts` (13 parents + 4 subcategories) is the single source of truth, mirrored by the SQL seed and the `categories.defaults` i18n namespace in `messages/{en,es}.json`. Validation `lib/validation/category.ts` (`createCategorySchema`/`updateCategorySchema`/`categoryRowSchema`) + tests; i18n sync test (`defaults.i18n.test.ts`) asserts every default key has an EN+ES label. RLS suite `tests/rls/categories.rls.test.ts` (7 cases incl. seed-on-signup, skipped without `TEST_DATABASE_URL`). **Verified:** `npm run typecheck`, `npm run lint`, `npm test` (104 pass / 17 skip) all green. **Scope:** Schema/DB only per the ticket — no CRUD UI (deferred to Settings P5-01) and no Server Actions yet (land with the transactions work P1-04/05 that consumes categories). **Known limit:** RLS can't cheaply assert `parent_id` is owned by the same user (FK checks bypass RLS); the app layer validates parent ownership + matching kind before write. **Action required:** `npm run db:migrate` to apply `0002`; then run the RLS suite against a disposable DB and confirm a fresh signup gets the default tree.

**P1-01 notes:** `lib/domain/money/` — pure domain module: integer cents + ISO-4217 currency, no floats. `money.ts` (constructors, exact + half-up-rounded arithmetic, compare, `convert`, `allocate` largest-remainder split), `format.ts` (Intl, locale-aware, forced 2 decimals), `errors.ts` (typed). Near-100% unit coverage. Skill `add-money-safe-feature` written. ADR-007 records the fixed-2-decimal choice.

## Phase 2 — Import engine
| ID | Ticket | Owner | Status |
|----|--------|-------|--------|
| P2-01 | Storage: private per-user bucket + upload (size/type limits, path RLS) | Schema/DB | TODO |
| P2-02 | Skill `add-import-adapter` + parser registry | Import | TODO |
| P2-03 | Generic CSV/Excel parser + column-mapping UI; save mapping template | Import | TODO |
| P2-04 | 2–3 real bank adapters | Import | TODO |
| P2-05 | Encoding/locale resilience (UTF-8/Latin-1, decimal/date/thousands) | Import | TODO |
| P2-06 | De-dup: deterministic fingerprint + fuzzy fallback | Import | TODO |
| P2-07 | Review-before-commit screen (new/dup/error counts + row preview) | Frontend | TODO |
| P2-08 | Idempotent commit; partial-failure handling | Import | TODO |
| P2-09 | File-safety hardening (CSV formula injection, oversized, malformed) | Security | TODO |
| **Gate** | import real statement, review accurate, commit once, re-import = no change | Coordinator | TODO |

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
