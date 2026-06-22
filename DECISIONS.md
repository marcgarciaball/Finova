# Finova — Decision Log (ADRs)

Each entry: context → decision → consequences. Newest at top.

---

## ADR-006 — Product name standardized to "Finova"
**Context:** The build brief prose calls the product "Finvia"; the folder and the GitHub repo (`github.com/marcgarciaball/Finova`) are both named "Finova".
**Decision:** Standardize on **Finova** (two real-world signals: folder + repo name) across docs, README, and UI strings.
**Consequences:** If "Finvia" was intended, this is a global find/replace + repo rename. Flagged to the owner for confirmation.

## ADR-005 — Native git hooks instead of Husky; regex Conventional Commits validator
**Context:** The brief specifies Husky + commitlint. The build sandbox has no general network access, so `npm install` of new dev-dependencies fails. Husky and commitlint can't be added here.
**Decision:** Use git's native `core.hooksPath` pointing at `.githooks/` with dependency-free shell scripts: `pre-commit` runs `npm run lint` (Biome) + `npm run typecheck`; `commit-msg` enforces Conventional Commits via a POSIX regex. A `prepare` npm script wires `core.hooksPath` on install.
**Consequences:** Same guarantees (pre-commit gate + commit message format) with zero dependencies. If the team later wants commitlint's richer rules, swap the regex for `@commitlint/cli` once installs are available.

## ADR-004 — `[locale]` route segment for i18n
**Context:** Bilingual ES/EN required from day one; next-intl supports locale-prefixed routing.
**Decision:** Use an `app/[locale]/` segment with route groups `(auth)` and `(app)`. Locale negotiated from path, with a switcher.
**Consequences:** All page routes live under `[locale]`. Auth callback route handlers stay at `app/auth/` (non-localized, machine-facing).

## ADR-003 — Drizzle ORM over Prisma
**Context:** Need an ORM that works with Supabase Postgres + RLS.
**Decision:** Drizzle — emits hand-editable plain SQL migrations (so RLS policies live in version-controlled migrations), runs on the serverless-friendly `postgres-js` driver, types infer from schema. Prisma's engine/migration model fights RLS and ships a binary runtime.
**Consequences:** RLS policies authored as SQL alongside Drizzle migrations. One source of truth for types.

## ADR-002 — Initialize git now
**Context:** Brief assumes a per-ticket PR workflow, which needs version control.
**Decision:** Use git from the start (repo now exists on `main` with remote `origin` = the Finova GitHub repo).
**Consequences:** Note — the build sandbox blocks writes inside `.git`, so commits are made by the human operator (or an unsandboxed step), not the build agent.

## ADR-001 — Keep npm + Biome (deviate from pnpm + ESLint/Prettier)
**Context:** The brief lists pnpm + ESLint/Prettier as "non-negotiable", but the pre-existing scaffold already uses npm (`package-lock.json`) + Biome (`biome.json`), both working and configured.
**Decision:** Keep **npm + Biome**. Biome covers lint + format in one fast tool; the npm lockfile is already present. The brief's *intent* — a lint+format gate enforced in CI and pre-commit — is fully satisfied.
**Consequences:** CI and hooks call `biome check` / `npm`. No ESLint/Prettier/pnpm configs. Decided by the owner.
