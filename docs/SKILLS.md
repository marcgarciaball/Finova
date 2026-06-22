# Finova — Reusable Skills Registry

A skill = a short playbook + checklist (+ any scaffold script) for a recurring task, so the system speeds up over time. **Build each skill the first time its ticket needs it, then reuse it.** Until built, status is `PLANNED`.

When a skill is built, create `docs/skills/<name>.md` with: trigger (when to use), steps, checklist, and any script path. Link it from the table below and flip status to `BUILT`.

| Skill | Built at | Status | Purpose |
|-------|----------|--------|---------|
| `setup-i18n-string` | P0-09 | PLANNED | Add a user-facing string: add key to `messages/en.json` + `messages/es.json`, reference via next-intl, never hardcode. Checklist guards against missing-key drift. |
| `write-rls-policy-and-tests` | P0-08 | PLANNED | Author a default-deny, ownership-scoped RLS policy for a table + a test proving user A cannot read/write user B's rows. The security backbone playbook. |
| `add-money-safe-feature` | P1-01 | PLANNED | Any feature touching money: integer cents + ISO currency, all math through `lib/domain/money`, near-100% unit coverage, no floats, currency mismatch handling. |
| `add-import-adapter` | P2-02 | PLANNED | Add one parser/adapter for a new statement format: register in the parser registry, map columns to the canonical transaction shape, fixtures from a real file, encoding/locale tests. |
| `add-categorization-rule` | P3-01 | PLANNED | Add/extend a categorization rule: match shape (merchant/desc/amount/account), priority ordering, deterministic apply, test against fixtures. |
| `security-review-checklist` | P5-05 (used earlier ad hoc) | PLANNED | The Security agent's standing checklist: authz (app + RLS), input validation (Zod), file safety, headers, secrets, error leakage. Run on every security-sensitive change; formalized at P5-05. |

## Conventions for every skill

- A skill is a *playbook*, not code that runs by itself — it encodes how we do the task cleanly and consistently.
- Each skill's checklist must map to the relevant Definition-of-Done items.
- Prefer a scaffold script (idempotent) when the task has boilerplate (e.g. new migration + RLS stub, new adapter file + test).
- Skills are versioned with the repo; update the playbook when the approach improves.
