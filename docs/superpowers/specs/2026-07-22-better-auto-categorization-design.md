# Better auto-categorization: Transfers category, word-boundary rules, review queue

Status: approved (2026-07-22)
Related tickets: P3-04 (default rules), P3-05 (learn-from-correction), P3-07
(uncategorized/needs-review list — this spec is P3-07's design), P1-06
(transfer exclusion from totals)

## Goal

Real usage (see screenshot review 2026-07-22) surfaced two categories of
uncategorized noise the current rule set can't catch:

1. **Person-to-person money movement** — `TRANSFERENCIA A/DE ...`, `PAGO
   BIZUM ...`, `ABONO BIZUM DE ...` — has almost no default rule coverage
   (only the narrow `bizum recibido` phrase matches, as `other_income`).
2. **Small/local merchants matching only by short generic word** — e.g. `BAR
   EL GAT-BENICHEMBLA`, where "bar" itself isn't a seeded keyword because a
   plain substring match on "bar" would false-positive on words like
   "barcelona" or "embarque".

On top of expanding default rules, there's no bulk-friendly way today to
clear out the backlog of already-uncategorized transactions — "Make a rule"
only exists per-row, requiring the user to open each transaction individually
with no queue or suggestion.

This spec covers three additive changes:
- A new **Transfers** category + `kind: 'transfer'`, excluded from
  income/expense/net totals like today's internal transfer pairs.
- A new **`contains_word`** clause op (word-boundary match) so short generic
  tokens (`bar`, `bizum`, `transferencia`) can be seeded safely.
- A **one-by-one review queue** at `/protected/transactions/review` that
  surfaces uncategorized rows with a suggested category (from the user's own
  categorization history) and creates a rule + sweeps matching rows on accept.

## Decisions (locked)

1. **`kind` grows a third value: `'transfer'`.** Today `categories.kind` is
   constrained to `'income' | 'expense'` (`drizzle/0002_spotty_sleeper.sql`).
   Rather than force person-to-person transfers into `expense`/`income` (which
   would pollute totals) or overload the existing `is_transfer` boolean
   (which means "linked internal transfer pair", a different concept), we add
   `'transfer'` as a third `kind`. The totals module (already excludes
   `is_transfer: true` rows per P1-06) is extended to also exclude any
   transaction whose category has `kind: 'transfer'`. A single system
   "Transfers" category is seeded (bilingual, `is_default: true`,
   `name_key: 'transfers'`), no subcategories.
2. **`contains_word` is a new, separate clause op — not a modification of
   `contains`.** Adding it to the `op` enum for `field: 'description'`
   clauses in `packages/domain/src/rules/types.ts` and `match.ts`:
   compiled as `new RegExp('\\b' + escapeRegex(value) + '\\b', 'iu')`,
   case-insensitive, Unicode word boundaries. Same try/catch-to-`false`
   safety as the existing `regex` op (defensive; word-boundary regex built
   from an escaped literal should never actually throw, but this keeps
   `matchesClause` total). Existing `contains`/`equals`/`starts_with`/`regex`
   rules are untouched — this is purely additive to the union.
3. **New default rules, only for the Transfers category and a small set of
   short generic tokens, all using `contains_word`:**
   - Transfers: `transferencia`, `bizum`, `traspaso`
   - Existing categories: `bar` → Restaurants (plus any other short token we
     find unsafe as plain `contains` while implementing — reviewed case by
     case, not a bulk sweep of all existing rules)
   These are added as new rows in the SQL seed function and the TS mirror,
   following the existing "add new rule, don't rewrite old ones" pattern
   established across `0008`/`0011`/`0012`.
4. **Review queue suggestion is frequency-based on the user's own past
   corrections, not fuzzy/ML matching.** For each uncategorized transaction,
   run the existing `suggestRuleToken` (from `packages/domain/src/rules/suggest.ts`)
   to extract the merchant token, then query the user's *already-categorized*
   transactions for the most common `category_id` among rows whose
   normalized description contains that same token. If there's a majority
   category, pre-fill it as the suggestion; otherwise leave the picker blank.
   This reuses the same token/normalization logic `suggestRuleFromCorrection`
   already uses — no new matching algorithm.
5. **Accept on the review queue creates a rule immediately and re-runs
   auto-categorization, so repeated merchants only need one review.** Accept
   calls the same `createRule` action already used by "Make a rule"
   (`app/protected/settings/rules/actions.ts`), building a `contains` rule by
   default, or a `contains_word` rule when the extracted token is short
   (≤ 4 characters, matching the same risk profile as decision 3) — then
   immediately calls `recategorizeUncategorized` so every other uncategorized
   row sharing that token gets swept in the same action. The queue re-queries
   afterward, so swept rows simply disappear from the remaining list.
6. **Skip is non-destructive.** Skip advances to the next transaction without
   creating a rule or marking anything; the transaction reappears in the
   queue next time it's opened. No "never ask again" affordance in v1 — if
   that becomes a real pain point we can add a per-transaction dismissal
   flag later, but it's speculative right now.

## Architecture

### Schema changes

- `lib/db/schema/categories.ts`: extend the `kind` check constraint /
  Postgres enum (however it's currently implemented — TEXT + CHECK per
  `0002_spotty_sleeper.sql:12`) to allow `'transfer'`. New migration adds the
  constraint change + seeds the "Transfers" category via an update to
  `seed_default_categories`.
- `packages/domain/src/categories/defaults.ts`: add `{ nameKey: 'transfers',
  kind: 'transfer' }` to the canonical default list (mirrors the SQL, same
  pattern as every other default category).
- `messages/en.json` / `messages/es.json`: add the `categories.defaults.transfers`
  i18n key pair (checked by the existing `defaults.i18n.test.ts` parity test).

### Rule matching (`packages/domain/src/rules/types.ts`, `match.ts`)

- Add `'contains_word'` to the `op` literal union for `field: 'description'`
  clauses.
- `matchesClause`: new branch —
  ```ts
  case 'contains_word': {
    try {
      return new RegExp(`\\b${escapeRegExp(clause.value)}\\b`, 'iu').test(txn.description)
    } catch {
      return false
    }
  }
  ```
  (`escapeRegExp` is a small new helper, or reuse one if already present
  elsewhere in the codebase — check before adding a duplicate.)
- `lib/validation/categorization-rule.ts`: extend the clause schema's `op`
  enum to accept `contains_word` for description clauses.
- Tests added to `match.test.ts`: word-boundary match succeeds on `BAR EL
  GAT` for token `bar`, fails on `BARCELONA`/`EMBARQUE`, case-insensitive,
  still respects AND-combination with other clauses.

### Totals exclusion (wherever P1-06's exclusion lives, e.g. `packages/domain/src/transactions/totals.ts` or similar)

- Extend the existing "is this transaction excluded from income/expense
  totals" predicate to also exclude rows where the joined category's
  `kind === 'transfer'`, alongside the existing `is_transfer` check. One
  predicate, two conditions OR'd together — no separate code path.

### Default rules seed

- `drizzle/00XX_transfer_and_word_boundary_rules.sql`: new migration, `CREATE
  OR REPLACE FUNCTION seed_default_rules` (superseding `0012`, following the
  established pattern) adds the new `contains_word` rows for Transfers + `bar`.
  Also updates `seed_default_categories` to add the Transfers category.
- `packages/domain/src/rules/defaults.ts` and
  `packages/domain/src/categories/defaults.ts`: mirrored additions, same
  "keep in sync" comment convention as today.

### Review queue

- **Route**: `app/protected/transactions/review/page.tsx` — server component,
  fetches the next uncategorized, non-transfer transaction
  (`category_id IS NULL AND is_transfer IS NOT TRUE`, ordered by date desc,
  limit 1) plus a total remaining count for a progress indicator ("14 left").
- **Suggestion core** (pure, testable): new function
  `suggestCategoryFromHistory(token: string, categorizedTxns: {description:
  string; categoryId: string}[]): string | null` in
  `packages/domain/src/rules/suggest.ts` — normalizes each candidate
  description, checks token containment, tallies `categoryId` frequency,
  returns the mode or `null` on no matches / no majority (tie → `null`,
  keeps it deterministic and simple).
- **Server action**: `app/protected/transactions/review/actions.ts` —
  `acceptReviewSuggestion(txnId, categoryId)`: looks up the transaction,
  derives the rule token via `suggestRuleToken`, calls the existing
  `createRule` (contains or contains_word per the ≤4-char rule), then calls
  the existing `recategorizeUncategorized`, then redirects/revalidates the
  review route so the next transaction loads.
  `skipReviewTransaction(txnId)`: no-op placeholder that just triggers
  navigation to the next transaction (nothing persisted — v1 "skip" is
  purely a client-side "show me the next one", per decision 6).
- **UI**: single-transaction card (description, amount, date, account),
  category `<select>` pre-filled with the suggestion if any, Accept/Skip
  buttons, progress text. Entry point: a "Review uncategorized (N)" link/button
  next to the existing "Auto-categorize" button on the transactions page,
  shown only when `N > 0`.

## Testing

- `packages/domain/src/rules/match.test.ts`: `contains_word` cases (word
  boundary hit/miss, case-insensitivity, AND-combination) — TDD, written first.
- `packages/domain/src/rules/suggest.test.ts`: `suggestCategoryFromHistory`
  cases (majority match, no match, tie → null, empty history).
- `packages/domain/src/categories/defaults.i18n.test.ts`: extended
  automatically once `transfers` is added to the canonical list (existing
  test iterates the list — verify it still passes with the new entry).
- Totals module's existing exclusion tests (P1-06, 11 unit tests per
  PROGRESS.md) get new cases for `kind: 'transfer'` categorized rows.
- RLS: no new table, so no new RLS suite needed — reuses `categories` and
  `categorization_rules` RLS already tested.

## Out of scope

- Splitting Transfers into In/Out (explicitly declined — single category).
- Fuzzy/ML-based merchant matching (explicitly declined — frequency-based
  token matching only, reusing existing suggestion logic).
- Bulk/grouped review UI (explicitly declined in favor of one-by-one, which
  still clears duplicates in one action via the immediate rule sweep).
- "Never suggest again" / permanent dismissal on skip.
- Retroactively re-running the new default rules against already-imported
  historical transactions that are *not* currently uncategorized (e.g. a
  transaction a user already manually categorized as "Other" won't be
  touched) — only affects rows with `category_id IS NULL`.

## Verification

`npm run typecheck`, `npm run lint`, `npm test` green. New migration applied
via `db:migrate` + confirmed in Supabase; review queue flow browser-verified
end-to-end (accept sweeps duplicates, skip advances without side effects,
Transfers rows excluded from dashboard totals).
