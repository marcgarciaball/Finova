# Finova — Decision Log (ADRs)

Each entry: context → decision → consequences. Newest at top.

---

## ADR-007 — Money stored as fixed 2-decimal integer minor units (cents)
**Context:** Finova is multi-currency, but EUR/USD (2-decimal) dominate. ISO-4217 exponents vary (JPY=0, KWD=3).
**Decision:** Represent every amount as integer cents = 1/100 of the major unit, regardless of currency, and force 2 fraction digits on display. The money module (`lib/domain/money`) is the single home for all money math.
**Consequences:** Simpler arithmetic and storage; correct for the currencies Finova actually uses. JPY/KWD would mis-render decimals if introduced. Upgrade path: replace the single `MINOR_UNITS = 100` factor with an ISO exponent lookup — contained to `money.ts`/`format.ts`, no caller changes.

---

## ADR-006 — Product name standardized to "Finova"
**Context:** The build brief prose calls the product "Finvia"; the folder and the GitHub repo (`github.com/marcgarciaball/Finova`) are both named "Finova".
**Decision:** Standardize on **Finova** (two real-world signals: folder + repo name) across docs, README, and UI strings.
**Consequences:** If "Finvia" was intended, this is a global find/replace + repo rename. Flagged to the owner for confirmation.

## ADR-005 — Native git hooks instead of Husky; regex Conventional Commits validator
**Context:** The brief specifies Husky + commitlint. The build sandbox has no general network access, so `npm install` of new dev-dependencies fails. Husky and commitlint can't be added here.
**Decision:** Use git's native `core.hooksPath` pointing at `.githooks/` with dependency-free shell scripts: `pre-commit` runs `npm run lint` (Biome) + `npm run typecheck`; `commit-msg` enforces Conventional Commits via a POSIX regex. A `prepare` npm script wires `core.hooksPath` on install.
**Consequences:** Same guarantees (pre-commit gate + commit message format) with zero dependencies. If the team later wants commitlint's richer rules, swap the regex for `@commitlint/cli` once installs are available.

## ADR-004 (revised P0-09) — Cookie-based locale, NOT `[locale]` routing
**Context:** Bilingual ES/EN required from day one. The original plan assumed `app/[locale]/` URL-prefixed routing. But Finova is a **private single-user app** — no SEO, no shareable public pages — and the user's locale is already a `profiles.locale` field. URL-prefixed locales would force restructuring the entire (working) app under `[locale]/` for no benefit.
**Decision:** Use next-intl **without i18n routing**. Active locale comes from a `NEXT_LOCALE` cookie (default `es`), resolved per request in `lib/i18n/request.ts`; a `LocaleSwitcher` writes it via a server action. No `[locale]` segment, no next-intl middleware, `proxy.ts` untouched.
**Consequences:** URLs never carry the locale. Simpler, lower-risk, locale follows the user. If any page ever needs to be public/shareable, URL routing can be layered in later. Superseded the original `[locale]` decision.

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
