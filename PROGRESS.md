# Finova — Progress Board

Status legend: `TODO` · `WIP` · `PARTIAL` (scaffold satisfies part of it) · `BLOCKED` · `DONE` (meets Definition of Done in the spec).

Work one ticket at a time, one PR each. Do not start a phase until the prior phase's gate passes.

> Note: a Supabase + Next.js starter scaffold pre-existed. Tickets already partly satisfied by it are marked `PARTIAL` with a note so the board reflects reality.

## Phase 0 — Foundation & guardrails
| ID | Ticket | Owner | Status |
|----|--------|-------|--------|
| P0-01 | Repo, package manager, lint/format, TS-strict, git hooks, Conventional Commits | Architect | REVIEW |
| P0-02 | CI pipeline: type-check + lint + tests on every PR | Architect | TODO |
| P0-03 | Env validation with Zod (`.env.example`, fail fast) | Backend/Domain | TODO |
| P0-04 | Supabase project + clients (server/browser, RN-portable) | Schema/DB | PARTIAL — clients exist in `lib/supabase/` |
| P0-05 | Auth: magic link (PKCE) + Google + optional password; harden callback | Security | PARTIAL — forms + confirm route exist; hardening TODO |
| P0-06 | Protected routes / session helpers; default-deny | Security | PARTIAL — `app/protected/` exists; `requireUser()` TODO |
| P0-07 | Drizzle setup + first migration; profiles table w/ RLS | Schema/DB | TODO |
| P0-08 | Skill: `write-rls-policy-and-tests`; prove A can't read B | Security | TODO |
| P0-09 | i18n wiring (next-intl), ES+EN, locale switch; skill `setup-i18n-string` | Frontend | TODO |
| P0-10 | Design tokens (CSS vars) + base layout/shell, dark/light | Frontend | PARTIAL — tokens in `app/globals.css`; `[locale]` shell TODO |
| P0-11 | Security headers (CSP/HSTS) + rate limit on auth | Security | TODO |
| **Gate** | sign up via magic link, switch language, hit protected page, tests green | Coordinator | TODO |

**P0-01 notes:** native git hooks in `.githooks/` (enable with `npm run prepare`); `tsconfig` gains `noUncheckedIndexedAccess`; `.env.example` seeded; README rewritten for Finova. Lint = 0 errors. Tracked inherited debt (non-blocking warnings): 6× `noNonNullAssertion` on `process.env` in `lib/supabase/*` → cleared by P0-03 Zod env module; 1× `noUselessFragments` info in demo `deploy-button.tsx` → cleared when starter landing is replaced (P0-09/P0-10).

## Phase 1 — Core data model & money safety
| ID | Ticket | Owner | Status |
|----|--------|-------|--------|
| P1-01 | Skill `add-money-safe-feature` + money module (cents+currency, full tests) | Backend/Domain | TODO |
| P1-02 | Schema+RLS `accounts`; CRUD Server Actions + UI | Schema/DB + Frontend | TODO |
| P1-03 | Schema+RLS `categories`/subcategories; bilingual default seed | Schema/DB | TODO |
| P1-04 | Schema+RLS `transactions` (full fields) | Schema/DB | TODO |
| P1-05 | Transactions UI: CRUD, filters, search, row recategorize | Frontend | TODO |
| P1-06 | Transfer flag excluded from income/expense totals (tested) | Backend/Domain | TODO |
| P1-07 | Multi-currency: base/display on profile; per-transaction currency | Backend/Domain | TODO |
| **Gate** | accounts/categories/transactions created, totals correct, RLS tested | Coordinator | TODO |

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
