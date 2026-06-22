# Finova

**Finova turns scattered bank statements and spreadsheets into one clear, trustworthy view of your money — without connecting to banks.**

Single-user, bilingual (Español / English), and money-safe by design. Upload statements, review exactly what was found *before* anything is saved, categorize automatically, and see it all on one dashboard. Your data, exportable any time.

> Finova is a personal-finance tool, **not financial advice**.

## What it does (MVP)

- **Import** — upload CSV/Excel statements; see new / duplicate / error counts and a row-level preview **before committing**. Re-importing the same file changes nothing.
- **Export** — get your data back out as CSV or JSON at any time.
- **Track** — transactions, categorized, editable, searchable.
- **Categorize** — sensible defaults + easy automatic rules you can extend.
- **Dashboard** — cash flow, spending by category, balances, and trends on one screen.
- **Bilingual** — Spanish + English from day one.

**Not in the MVP:** bank syncing / open banking, live market prices, portfolio tracking, billing, multi-user, native mobile, AI-written advice.

## Tech stack

- **Next.js 16** (App Router, Server Components + Server Actions), **React 19**, **TypeScript strict** (`noUncheckedIndexedAccess`).
- **Tailwind v4** with CSS-variable design tokens (theme-agnostic, dark/light ready).
- **Supabase** — Auth (magic-link PKCE + Google + optional password), Postgres via **Drizzle ORM** (migrations + RLS on every user table), Storage.
- **Zod** validation at every boundary · **next-intl** (ES/EN) · **TanStack Query** + Server Components.
- **Vitest** + Testing Library + Playwright.
- **npm + Biome** (lint & format), `tsc --noEmit`, native git hooks, Conventional Commits.

Business logic lives in framework-agnostic modules (`lib/domain`, `lib/import`, `lib/rules`) with no React/Next imports — so a future mobile client can reuse it.

## Getting started

```bash
npm install            # also wires git hooks via the `prepare` script
cp .env.example .env.local   # then fill in your Supabase + database values
npm run dev            # http://localhost:3000
```

If hooks weren't wired automatically (e.g. installed in a restricted environment):

```bash
npm run prepare        # git config core.hooksPath .githooks
```

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run lint` | Biome lint + format check |
| `npm run format` | Biome apply fixes |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` / `npm run test:watch` | Vitest |

### Git hooks

- **pre-commit** runs `npm run lint` + `npm run typecheck`.
- **commit-msg** enforces [Conventional Commits](https://www.conventionalcommits.org/) (`feat(import): …`).

## Project layout

```
app/          Next.js routes (App Router). UI shell lives under app/[locale]/
components/   Presentational React + shadcn primitives (no business logic)
lib/domain/   PURE money & totals logic — no framework imports
lib/import/   PURE parsers, adapters, de-dup
lib/rules/    PURE categorization engine
lib/db/       Drizzle schema, migrations, RLS policies
lib/supabase/ Supabase server/browser clients
messages/     en.json + es.json i18n catalogs
docs/         Specs, decisions, team & skills playbooks
```

## How the work is organized

- **`PROGRESS.md`** — the phased ticket board (Phases 0–5). One ticket, one PR.
- **`DECISIONS.md`** — architecture decision records (ADRs).
- **`docs/TEAM.md`** — agent roles, per-ticket loop, phase gates.
- **`docs/SKILLS.md`** — reusable playbooks built first-time-needed.
- **`docs/superpowers/specs/`** — design specs per phase.

## Principles

Security and correctness over speed · money is always integer cents + a currency code (never floats) · review-before-commit for every import · single-user · default-deny RLS on every user table.
