# Skill: add-categorization-rule

**Trigger:** any time you author or extend Finova's categorization rules — a new clause field/operator (P3-02), default seeded rules (P3-04), or a "make this a rule" flow (P3-05). For the *matcher* itself see P3-02; this skill covers the rule **data shape** and how to express a rule correctly.

**Goal:** a valid `categorization_rules` row whose `conditions` parse cleanly against the schema, so the matcher (P3-02) and the import seam (P3-03) consume one stable contract.

## The contract

A rule is the `Rule` type in [`lib/domain/rules/types.ts`](../../lib/domain/rules/types.ts):

```ts
interface Rule {
  id: string
  categoryId: string
  conditions: Clause[]   // non-empty; AND-combined
  priority: number       // lower = higher priority; created_at breaks ties
  enabled: boolean
}
```

`conditions` is the runtime-validated heart. A `Clause` is one of:

| field          | op                                         | value                          |
|----------------|--------------------------------------------|--------------------------------|
| `description`  | `contains` `equals` `starts_with` `regex`  | string (1–200 chars)           |
| `amount_cents` | `lt` `lte` `gt` `gte` `eq`                  | integer cents; `absolute?` flag |
| `account_id`   | `eq`                                       | uuid                           |

**Semantics (locked in P3-01):**
- **AND-only.** All clauses in a rule must match. Need OR? Author two rules.
- **First match wins**, ordered by `priority` ascending, `created_at` ascending on ties. (Ordering semantic is owned by the P3-02 matcher; the `(user_id, enabled, priority)` index backs the ordered fetch.)
- **`amount_cents` is signed** — negative is expense, positive is income. Use `absolute: true` to compare `|amount_cents|` when the sign is irrelevant (e.g. "any transaction over €100, in or out").

## Expressing common rules

- **Merchant contains** → `{ field: 'description', op: 'contains', value: 'mercadona' }`
- **Expense over €50** → `{ field: 'amount_cents', op: 'lt', value: -5000 }` (signed: more-negative is a bigger expense) or sign-agnostic `{ field: 'amount_cents', op: 'gt', value: 5000, absolute: true }`
- **Scoped to one account** → add `{ field: 'account_id', op: 'eq', value: '<uuid>' }` as a second clause.

## Steps

1. **Author conditions against the schema as the source of truth.** [`conditionsSchema`](../../lib/validation/categorization-rule.ts) is the runtime contract for the `conditions` jsonb — `createCategorizationRuleSchema` for a full new rule, `updateCategorizationRuleSchema` for a partial edit. Never hand-build the jsonb; build the object and parse it.
2. **Keep the schema and the domain type in lockstep.** Adding a field/op means editing **both** `lib/domain/rules/types.ts` and `lib/validation/categorization-rule.ts`. The `_AssertConditionsMatch` type assertion at the bottom of the validator fails the build if they drift — that's the guardrail, not an afterthought.
3. **TDD the matcher fixture (P3-02).** Write the failing match test first: a `Rule` + a `RawTxn`-like row → expected `categoryId | null`. Money comparisons are integer cents only — no floats, no `parseFloat`. The matcher is pure: no I/O, no `Date.now()`.
4. **Money rules follow [`add-money-safe-feature`](add-money-safe-feature.md).** Amounts are integer cents end to end.

## RLS expectation

`categorization_rules` is owner-scoped, default-deny — four policies mirroring `categories` (`*_select/insert/update/delete_own`, each `(select auth.uid()) = user_id`). `category_id` is **ON DELETE CASCADE** (a rule whose category is gone can't act, so it's removed with it — unlike `transactions.category_id` SET NULL). New behavior touching the table must keep the RLS isolation suite green ([`tests/rls/categorization-rules.rls.test.ts`](../../tests/rls/categorization-rules.rls.test.ts)).

## Checklist (maps to Definition of Done)

- [ ] Conditions validate against `conditionsSchema`; non-empty, correct clause shapes.
- [ ] Domain type and Zod schema edited together; `_AssertConditionsMatch` still compiles.
- [ ] Matcher logic (P3-02) is pure and TDD'd; money in integer cents.
- [ ] `regex` values stay ≤200 chars (ReDoS cap); matcher executes patterns safely (P3-02).
- [ ] RLS isolation suite green; owner-scoped, default-deny preserved.

## Default rules (P3-04, built)

Default rules live in `lib/domain/rules/defaults.ts` (`DEFAULT_RULES`) — the single canonical source, mirrored by `public.seed_default_rules()` (migration 0008) and the `rules.defaults.*` i18n catalog. They seed on signup (after the default categories) via the `on_auth_user_created_seed_rules` trigger. To add one: append to `DEFAULT_RULES` with a distinct priority (≥100), target a category by its `name_key`, then update the SQL seed VALUES list and add EN+ES labels — the `defaults.test.ts` guards (referential integrity, unique keys/priorities, i18n parity) fail the build if any drift.

## Run the tests

```bash
npx vitest run lib/validation/categorization-rule
TEST_DATABASE_URL="postgresql://..." npm test -- rls
```
