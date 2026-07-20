# P3-06 — "Test rule against existing data" preview

Status: approved (2026-06-28)
Ticket: P3-06 — "Test rule against existing data" preview
Phase: 3 — Categorization & rules

## Goal

Before saving a rule, let the user see how many of their existing transactions
it would match (and a sample of them) — so they can tune the clause without
guessing. This ticket ships the **deterministic pure core**
(`previewRuleMatches`); the Server Action that fetches the user's transactions
(RLS-enforced) and the rule-editor preview panel are the P5-01 follow-up.

## Decisions (locked)

1. **Preview a bare `RuleConditions`, not a persisted rule.** The user is
   editing an unsaved rule, so the core takes the conditions array directly and
   wraps it in a minimal enabled rule to reuse the P3-02 `matchesRule` AND
   semantics unchanged — one matching code path, no divergence.
2. **Count all matches, cap the returned rows.** `matched` reflects the whole
   sample; `rows` is capped (default 50) so a large history doesn't balloon the
   payload — mirrors the P2-07 review preview cap.
3. **Operates on `MatchableTxn`.** The action maps each fetched transaction row
   to `{ description, amountCents: amount_cents, accountId: account_id }`, the
   same shape the matcher and the on-demand re-categorization (P3-03 design) use.

## Architecture

### `lib/domain/rules/preview.ts` (new)

```ts
export interface RulePreview { total: number; matched: number; rows: MatchableTxn[] }
export function previewRuleMatches(
  conditions: RuleConditions,
  txns: MatchableTxn[],
  opts?: { limit?: number }
): RulePreview
```

### Action + UI (P5-01 follow-up, documented)

`previewRule({ conditions })` Server Action: `requireUser`, validate with
`conditionsSchema`, fetch the user's transactions (RLS-enforced, newest first,
reasonable cap), map to `MatchableTxn`, return `previewRuleMatches`. The rule
editor renders "would match N of M; e.g. …". Needs browser verification.

## Tests — `lib/domain/rules/preview.test.ts`

Match counting + total, zero-match, the sample-row cap (counts all, returns
`limit`), and AND semantics across clauses.

## Out of scope

- The Server Action + preview UI — **P5-01** (designed above).

## Verification

`npm run typecheck`, `npm run lint`, `npm test` green. Pure module — no DB step.
