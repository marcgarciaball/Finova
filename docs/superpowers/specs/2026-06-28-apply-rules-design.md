# P3-03 — Apply rules on import + on demand

Status: approved (2026-06-28)
Ticket: P3-03 — Apply rules on import + on demand; deterministic + tested
Phase: 3 — Categorization & rules

## Goal

Wire the P3-02 matcher into the product so imported (and existing) transactions
get auto-categorized deterministically. Two consumers:

1. **On import** — the P2-08 commit seam (`applyImportCategorization`) stops
   returning all-`null` and instead resolves each row's category through
   `selectCategory` using the user's enabled rules. This is the half this ticket
   ships end-to-end (it completes the seam P2-08 deliberately pre-wired).
2. **On demand** — a "re-run rules on existing transactions" action over the
   `transactions` list. Documented here; lands with the rules-management UI
   (P5-01 Settings) since it needs a surface to trigger it and browser
   verification.

## Decisions (locked)

1. **The seam takes the batch account.** `applyImportCategorization` gains an
   `accountId` argument: every row in one import batch belongs to the batch's
   account (chosen at review time), and `RawTxn` deliberately has no account.
   The function adapts each `RawTxn` → `MatchableTxn`
   (`{ description, amountCents, accountId }`) and delegates to `selectCategory`.
   Signature: `applyImportCategorization(txns: RawTxn[], rules: Rule[], accountId: string)`.
2. **Rules are fetched RLS-enforced, ordered, enabled-only.** A new data helper
   reads `categorization_rules` through the Supabase server client (RLS scopes
   to the owner), `ORDER BY priority asc, created_at asc`, filtered to
   `enabled = true`. Rows are parsed with `categorizationRuleRowSchema` and
   mapped to the domain `Rule` via a pure, tested `toDomainRule`. The
   priority+created_at order *is* the precedence `selectCategory` relies on (its
   stable sort then only needs `priority`).
3. **Determinism.** Matching is pure (P3-02); the only nondeterminism is the
   fetch order, which the `ORDER BY` pins. Same rules + same rows ⇒ same
   categories, every run — required for the idempotent re-import invariant
   (a re-imported row that was auto-categorized stays categorized the same way,
   and the fingerprint upsert still de-dups it).
4. **Categorization never blocks a commit.** A row that matches no rule commits
   uncategorized (`null`), exactly as today. Rules failing to load is treated as
   "no rules" (commit proceeds uncategorized) rather than aborting the import —
   categorization is an enhancement, not a gate.

## Architecture

### 1. Pure row→domain mapper — `lib/validation/categorization-rule.ts`

```ts
export function toDomainRule(row: CategorizationRuleRow): Rule
// { id, categoryId: row.category_id, conditions: row.conditions,
//   priority: row.priority, enabled: row.enabled }
```

A tiny, tested boundary mapper from the snake_case persisted row to the
camelCase domain `Rule`. Keeps the data layer free of hand-mapping.

### 2. Seam body — `lib/domain/import/categorize.ts`

`applyImportCategorization(txns, rules, accountId)` maps each `txn` to a
`MatchableTxn` and returns `selectCategory(rules, m)` per row — index-aligned,
same length. Still pure: no I/O.

### 3. Rules fetch — `app/protected/import/data.ts`

```ts
export async function listEnabledRulesForCategorization(): Promise<Rule[]>
```

`requireUser()` → RLS-enforced select on `categorization_rules`, `eq('enabled', true)`,
`order('priority').order('created_at')`, parse each row, `toDomainRule`.

### 4. Wiring — `app/protected/import/actions.ts#commitBatch`

Replace `applyImportCategorization(newTxns, [])` with a fetch of the user's
rules (in a try/catch that degrades to `[]`) and
`applyImportCategorization(newTxns, rules, accountId)`. Nothing else in the
commit path changes — `buildCommitRows` already threads `categoryIds`.

### 5. On demand (documented; built with P5-01)

A `recategorizeAllTransactions` Server Action: fetch enabled rules + the user's
transactions (RLS-enforced), compute `selectCategory` per row from
`{ description, amountCents: amount_cents, accountId: account_id }`, and update
only rows whose category changes. Out of scope for the code in this ticket —
needs a trigger surface and browser verification.

## Tests

- `lib/validation/categorization-rule.test.ts` — `toDomainRule` maps a row to a
  `Rule` (snake→camel, fields preserved).
- `lib/domain/import/categorize.test.ts` — rewritten for the new signature:
  empty rules ⇒ all `null`; a matching rule ⇒ its `categoryId`; only the
  highest-priority match wins; rows are index-aligned; the batch `accountId` is
  used for `account_id` clauses.

## Out of scope

- On-demand re-categorization UI + action — **P5-01** (designed above).
- Default seeded rules — **P3-04**.
- Rules CRUD UI — **P5-01**.

## Verification

`npm run typecheck`, `npm run lint`, `npm test` green. Browser: with a rule
"description contains X → category C", import a file containing X → committed row
lands in C; re-import → still de-duped, still in C (deterministic).
