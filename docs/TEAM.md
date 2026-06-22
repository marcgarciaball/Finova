# Finova — Agent Team & Working Model

Finova is built by specialized agents with clean handoffs. This file defines who owns what and the loop every ticket runs through. Roles are hats, not people — one operator may wear several, but the responsibilities and veto powers below always apply.

## Roster & ownership

| Agent | Owns | Veto |
|------|------|------|
| **Coordinator** | Sequences tickets, prevents scope creep, maintains `PROGRESS.md` / `DECISIONS.md`, runs phase gates, signs off tickets. | Can block starting a new phase. |
| **Architect** | Folder structure, module boundaries, ADRs — decided before code. Owns the `lib/*` purity rule. | — |
| **Schema/DB** | Drizzle schema, migrations, **RLS policies**, seed data, money/date conventions. | — |
| **Import** | File parsers, bank/template adapters, de-dup, review-before-commit, encoding/locale. | — |
| **Rules** | Categorization rules engine, defaults, learn-from-correction. | — |
| **Backend/Domain** | Pure logic in `lib/domain`, Server Actions, services, money module. | — |
| **Frontend** | Accessible, responsive, token-based UI; wires i18n; empty states. | — |
| **Security** | Threat-models every change, writes RLS/authorization tests, hardens auth/files/headers. | **Veto power** on any change. |
| **QA/Test** | Unit + e2e, fixtures from real bank files, verifies Definition of Done. | Can block sign-off if DoD unmet. |

## Per-ticket loop

```
Plan  →  Schema + RLS (if data)  →  Domain (pure lib/*)  →  Server Action
      →  UI + i18n  →  Tests (incl. security)  →  Security review  →  Coordinator sign-off
```

A ticket is **Done** only when it meets the Definition of Done (see the spec / §4 of the brief). Don't start the next ticket's UI before its domain logic and tests exist.

## Phase gate (run by Coordinator at each phase boundary)

1. All tests green (`npm test`).
2. Lint + type clean (`npm run lint`, `npm run typecheck`).
3. Security review passed (no Security veto open).
4. Manual smoke test of the phase's headline features.
5. Report results in `PROGRESS.md`, then ask the owner to proceed.

## How agents are dispatched in this environment

- Independent tickets (no shared files/state) can be handed to parallel subagents.
- Data-touching work always pairs Schema/DB + Security (RLS authored and tested together).
- Pure-logic modules (`lib/domain`, `lib/import`, `lib/rules`) are built and unit-tested in isolation before any Server Action or UI wires them — this is also what keeps the Expo reuse seam clean.
- Every new capability checks `docs/SKILLS.md` first: if a matching playbook exists, follow it; if it's the first time, build the skill, then use it.
