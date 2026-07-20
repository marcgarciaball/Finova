# P3-05 — Learn from correction: "make this a rule"

Status: approved (2026-06-28)
Ticket: P3-05 — Learn-from-correction: "make this a rule"
Phase: 3 — Categorization & rules

## Goal

When a user recategorizes a transaction, offer to turn that correction into a
rule so future imports of the same merchant auto-categorize. This ticket ships
the **deterministic pure core** — deriving a sensible rule suggestion (a
`description contains <token>` clause targeting the chosen category) from a
transaction. The UI affordance + the create-rule Server Action are the
browser-gated follow-up (P5-01 Settings hosts rule CRUD); the core is built and
tested now so the UI just calls it.

## Decisions (locked)

1. **Suggest a single `description contains <token>` clause.** It is the most
   robust, explainable rule shape and matches how the P3-04 defaults work.
2. **The token is the merchant-ish word**, derived by reusing
   `normalizeDescription` (accent/case-folded, punctuation→space) then dropping
   common banking prefixes (`compra`, `pago`, `recibo`, `tarjeta`,
   `transferencia`, `bizum`, `payment`, `card`, `purchase`, …) and pure-numeric
   / very-short tokens. The first surviving token wins; if none survive, fall
   back to the whole normalized string (never produce an empty token — that
   would match everything).
3. **Suggested rules are user rules: `priority` 0.** A user's explicit
   correction must outrank the seeded defaults (priority ≥ 100). `name_key` is
   null (user-authored), `name` defaults to the title-cased token unless the
   caller supplies one.
4. **The core returns a `createCategorizationRuleSchema`-valid object**, so the
   action layer can validate + persist with no reshaping. Pure: no I/O.

## Architecture

### `lib/domain/rules/suggest.ts` (new)

```ts
export function suggestRuleToken(description: string): string
export function suggestRuleFromCorrection(input: {
  description: string
  categoryId: string
  name?: string
}): { name: string; categoryId: string; conditions: RuleConditions; priority: number }
```

`suggestRuleToken` implements the heuristic in decision 2.
`suggestRuleFromCorrection` builds the suggestion object (priority 0, single
contains-clause on the token, name = supplied or title-cased token).

### UI + action (P5-01 follow-up, documented)

A "Make a rule from this" control on a recategorized row → a confirm dialog
pre-filled from `suggestRuleFromCorrection` → a `createCategorizationRule`
Server Action (`requireUser`, validate with `createCategorizationRuleSchema`,
verify the category is owned, insert RLS-enforced). Needs browser verification.

## Tests — `lib/domain/rules/suggest.test.ts`

- Strips a leading banking prefix (`COMPRA MERCADONA…` → `mercadona`).
- Ignores pure-number and too-short tokens.
- Accent/case folded (`Día` handled).
- Falls back to the full normalized string when every token is noise (never empty).
- `suggestRuleFromCorrection` output parses against `createCategorizationRuleSchema`,
  has priority 0, and a single contains-clause carrying the token.

## Out of scope

- The UI control + create-rule action — **P5-01** (designed above).
- Multi-clause suggestions / amount heuristics — deferred (YAGNI for v1).

## Verification

`npm run typecheck`, `npm run lint`, `npm test` green. Pure module — no DB step.
