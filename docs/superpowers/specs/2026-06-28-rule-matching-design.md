# P3-02 — Rule matching engine: clauses, priority, enable/disable

Status: approved (2026-06-28)
Ticket: P3-02 — Rule matching (merchant/desc/amount/account), priority, enable/disable
Phase: 3 — Categorization & rules

## Goal

Implement the **pure matching engine** that turns the P3-01 rule data into a
decision: given a transaction and a user's rules, which category (if any) wins.
This ticket ships the deterministic, tested domain core only — `matchesClause`,
`matchesRule`, and `selectCategory` in `lib/domain/rules/match.ts`. It wires
nothing: apply-on-import + apply-on-demand is **P3-03**, default rules are
**P3-04**, CRUD Server Actions + UI are a P3-02 follow-up / **P5-01**.

It builds directly on the contract P3-01 locked (`lib/domain/rules/types.ts`):
the `Clause` union, AND-only `RuleConditions`, and the `Rule` shape. Like every
Phase-2 pure core (fingerprint, locale-parse, mapping), it is built ahead of the
phase gate because it has no stateful edges — no I/O, no DB, no `Date.now()`.

## Decisions (locked)

1. **`selectCategory` is first-match-wins over a caller-ordered list.** The
   matcher does a **stable sort by `priority` ascending** and returns the first
   *enabled* rule whose clauses all match. Ties in `priority` are broken by the
   caller's input order — P3-03 fetches rules via the
   `(user_id, enabled, priority)` index with `ORDER BY priority, created_at`, so
   input order *is* `created_at` order. The `Rule` type stays unchanged (no
   `createdAt` field needed in the domain): precedence is "priority, then
   position". This keeps the matcher pure and the contract stable.
2. **String clauses are case-insensitive; accent-sensitive (v1).** `contains` /
   `equals` / `starts_with` compare with both sides lower-cased (bank
   descriptions vary in case). Accent-folding is deliberately **not** applied in
   v1 (it would diverge from what the user typed in the rule); if ES merchants
   need it later, fold both sides through the same normalizer the fingerprint
   uses. Documented as a known limit, not a silent choice.
3. **`regex` is compiled case-insensitively and executed totally.** `new
   RegExp(value, 'i')` is wrapped in try/catch — an invalid pattern matches
   nothing (returns `false`) rather than throwing, so a bad rule can never crash
   a batch. The P3-01 200-char cap bounds the ReDoS surface; matching runs
   in-process over a user's own rules + own data, so the blast radius is
   self-limited (full safe-execution / timeout is out of scope for v1).
4. **Amount comparison is signed by default, `absolute` opt-in.** `amount_cents`
   clauses compare the transaction's signed `amountCents` against `clause.value`
   with the five operators; `absolute: true` compares `Math.abs(amountCents)`.
   All integer cents — no floats (consistent with the money module).
5. **The matcher operates on a minimal `MatchableTxn`, not `RawTxn`.** Matching
   needs exactly `description`, `amountCents` (signed), and `accountId`. `RawTxn`
   (P2-02) has no `accountId` (the account is chosen per batch), so P3-03 adapts
   each row to a `MatchableTxn` by pairing it with the batch's account. Defining
   the minimal shape here keeps the matcher independent of the import row shape
   and reusable by the on-demand path (existing `transactions` rows) too.

## Architecture

### `lib/domain/rules/match.ts` (new)

```ts
import type { Clause, Rule } from '@/lib/domain/rules/types'

/** The minimum a transaction must expose to be matched against rules. */
export interface MatchableTxn {
  description: string
  /** Signed integer cents (negative = expense, positive = income). */
  amountCents: number
  accountId: string
}

/** Does one clause hold for this transaction? Total — never throws. */
export function matchesClause(clause: Clause, txn: MatchableTxn): boolean

/** Do ALL of a rule's clauses hold (AND-combined)? Ignores `enabled`. */
export function matchesRule(rule: Rule, txn: MatchableTxn): boolean

/**
 * The category a transaction should get, or `null` if no enabled rule matches.
 * Enabled rules are considered in `priority` ascending order; ties keep the
 * caller's input order (= created_at order, per the P3-03 fetch). First match
 * wins. Pure, deterministic, total.
 */
export function selectCategory(rules: Rule[], txn: MatchableTxn): string | null
```

- `matchesClause` switches on `clause.field`:
  - `description`: lower-case both sides; `contains` → `includes`, `equals` →
    `===`, `starts_with` → `startsWith`, `regex` → `new RegExp(value, 'i')`
    in a try/catch (invalid → `false`).
  - `amount_cents`: pick `txn.amountCents` or `Math.abs(...)` when `absolute`,
    then apply `lt/lte/gt/gte/eq`.
  - `account_id`: `txn.accountId === clause.value`.
- `matchesRule`: `rule.conditions.every((c) => matchesClause(c, txn))`. Conditions
  are non-empty by construction (P3-01 validation), so this is never vacuously
  true on a persisted rule.
- `selectCategory`: filter `enabled`, **stable-sort** by `priority` (a stable
  sort preserves input order for equal keys — JS `Array.prototype.sort` is
  stable per spec), `find` the first `matchesRule`, return its `categoryId` or
  `null`.

No new schema, migration, validation, or i18n. No changes to
`categorize.ts` (its body still returns `null` until P3-03 calls `selectCategory`).

### Tests — `lib/domain/rules/match.test.ts`

TDD, written first. Cases:
- Each description op (contains/equals/starts_with), case-insensitively;
  non-match returns false.
- `regex` matches; an **invalid** regex returns false (no throw).
- Each amount op against a signed value; `absolute` flips an expense to match a
  positive threshold.
- `account_id` eq match / mismatch.
- AND semantics: a two-clause rule matches only when both hold.
- `selectCategory`: priority ordering (lower wins), a disabled higher-priority
  rule is skipped in favour of an enabled lower one, ties broken by input order,
  no match → `null`, empty rule list → `null`.

## Data flow (P3-03 will wire this)

```
selectCategory(rulesOrderedByPriorityThenCreatedAt, { description, amountCents, accountId })
  → first enabled rule whose AND-clauses all match → rule.categoryId, else null
```

## Out of scope

- Apply-on-import + apply-on-demand wiring, the rules fetch query — **P3-03**.
- Default seeded rules — **P3-04**.
- CRUD Server Actions + UI — P3-02 follow-up / **P5-01**.
- Accent-insensitive matching, regex execution timeouts — explicitly deferred.

## Verification

`npm run typecheck`, `npm run lint`, `npm test` green. Pure module — no DB step.
