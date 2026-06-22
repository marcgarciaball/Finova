# Finova MVP — Foundation Design (Phases 0–1)

> Date: 2026-06-22 · Status: approved · Scope: program-level operating design + Phase 0–1 data model. Later phases (import, rules, dashboard, hardening) get their own spec → plan → implement cycle.

## Product in one line

Finova turns scattered bank statements and spreadsheets into one clear, trustworthy view of personal money — **without connecting to banks**. Single-user, bilingual (ES/EN), money-safe, review-before-commit imports.

## Non-goals (do not build in MVP)

Bank syncing / open banking · real-time market or investment prices · holdings/portfolio tracking · billing/payments · multi-user · native mobile · community/voting · shareable images · AI-written advice. Leave clean seams; build none of it.

## Principles

Security and correctness over speed · **never floats for money** (integer cents + currency code) · review-before-commit for all imports · single-user only · "not financial advice" where relevant.

## Tech stack (as built — see DECISIONS.md for deviations from the original brief)

- Next.js 16 (App Router), React 19, TypeScript strict + `noUncheckedIndexedAccess`.
- Tailwind v4 with CSS-variable design tokens (theme-agnostic; tokens already in `app/globals.css`).
- Supabase: Auth (magic-link PKCE + Google + optional password), Postgres via **Drizzle ORM**, RLS on every user table, Storage for uploads.
- Validation: **Zod** at every boundary (forms, Server Actions, parsers, env).
- i18n: **next-intl**, ES + EN, no hardcoded strings.
- Server-state: TanStack Query (client) + Server Components (reads).
- Testing: Vitest (unit), Testing Library (components), Playwright (e2e).
- Tooling: **npm + Biome** (lint+format), `tsc --noEmit`, native git hooks, Conventional Commits. (Original brief said pnpm + ESLint/Prettier + Husky; we kept the working scaffold — ADR-001/002/005.)

## Architecture & folder boundaries

```
app/[locale]/(auth)/      login, sign-up, callback
app/[locale]/(app)/       protected shell: dashboard, transactions, import, settings
app/auth/                 callback route handlers (redirect allowlist)
components/                presentational React + shadcn ui/ (no business logic)
lib/domain/   PURE  money, totals, category types — no React/Next/Supabase imports
lib/import/   PURE  parsers, adapters, dedup fingerprinting, column mapping
lib/rules/    PURE  rule matching engine, defaults
lib/validation/    Zod schemas (shared by forms, actions, parsers, env)
lib/db/            Drizzle schema, client, migrations, RLS policy SQL
lib/supabase/      existing server/client/proxy helpers
lib/i18n/          next-intl config, locale routing
lib/auth/          requireUser() default-deny guards
messages/          en.json, es.json
server/            Server Actions (thin: validate -> lib/domain -> db)
tests/             vitest unit + Playwright e2e; fixtures/ for real bank files
drizzle/           generated migrations
```

**Hard rule (Expo reuse seam):** `lib/domain`, `lib/import`, `lib/rules` import nothing from React/Next/Supabase. Enforced by lint boundary + review.

## Drizzle vs Prisma (ADR-003)

Drizzle is a thin TS-first query builder emitting plain SQL migrations we can hand-edit to add **RLS policies** — the security backbone here. Prisma's engine and migration model fight Supabase RLS and ship a binary runtime; Drizzle runs on the serverless-friendly `postgres-js` driver Supabase recommends. Types infer from schema → one source of truth.

## Auth & callback hardening (P0-05)

1. Magic link via PKCE (`app/auth/confirm/route.ts` scaffolded).
2. Redirect **allowlist**: `next` param validated against a fixed set of internal paths; reject absolute/external URLs.
3. `emailRedirectTo` pinned to a server-known origin, never client-supplied.
4. Every protected route guarded by `requireUser()` (default-deny) **in addition to** RLS.
5. Google OAuth + optional password behind the same hardened callback.

App-layer auth and RLS both enforced and tested — belt and suspenders.

## Phase 0–1 data model

Every table has `user_id uuid not null` and **default-deny RLS** (`using (auth.uid() = user_id)` for select/insert/update/delete).

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id`(=auth.uid), `base_currency`, `display_currency`, `locale` | P0-07, 1:1 with auth.users |
| `accounts` | `id, user_id, name, type(bank/cash/savings/debt), currency, archived` | P1-02 |
| `categories` | `id, user_id, parent_id?, name_key, kind(income/expense), is_default` | P1-03, self-ref subcategories |
| `transactions` | `id, user_id, account_id, category_id?, amount_cents bigint, currency, occurred_at(UTC), description, note?, tags[], is_transfer, transfer_group_id?, is_recurring` | P1-04 |

Relations: `accounts 1—* transactions`; `categories 1—* transactions`. Transfers link two transactions via `transfer_group_id` and are excluded from income/expense totals (P1-06). Money is always integer `amount_cents` + ISO currency code — never float.

## Definition of Done (every ticket)

1. TS-strict, lint-clean, formatted; no unjustified `any`.
2. All input Zod-validated; app-layer auth + RLS both enforced and tested.
3. No hardcoded strings — i18n ES + EN updated.
4. Money = integer cents + currency; dates stored UTC.
5. Unit tests for logic (parsers/rules/money near-100%) + ≥1 e2e for user-facing flows.
6. Accessible (keyboard, focus, semantic HTML, contrast) and responsive.
7. No secrets/console noise; errors clear and in product voice.
8. `PROGRESS.md` updated; concise PR description.

## Operating model

Work the board in `PROGRESS.md` one ticket at a time, one PR each. A phase is not started until the prior phase's gate passes (tests green, lint/type clean, security review, manual smoke). Roles in `docs/TEAM.md`; reusable playbooks in `docs/SKILLS.md` built first-time-needed. Decisions logged in `DECISIONS.md`.
