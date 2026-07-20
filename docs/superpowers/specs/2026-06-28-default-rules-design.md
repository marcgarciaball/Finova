# P3-04 — Sensible default categorization rules (bilingual)

Status: approved (2026-06-28)
Ticket: P3-04 — Sensible default rules (bilingual)
Phase: 3 — Categorization & rules

## Goal

Ship a curated set of default categorization rules so a fresh account
auto-categorizes common Spanish + international merchants out of the box (the
import adapters target ES banks). Mirrors the P1-03 default-categories design
exactly: one canonical TS source of truth, a `SECURITY DEFINER` seed function +
signup trigger that plants the rows past RLS, idempotent via a partial unique
index, bilingual display via `name_key` → i18n.

## Decisions (locked)

1. **Default rules seed on signup, like default categories.** A new
   `seed_default_rules(uuid)` runs from an `AFTER INSERT ON auth.users` trigger.
   The trigger is named `on_auth_user_created_seed_rules` so it fires *after*
   `on_auth_user_created_seed_categories` (Postgres fires per-event triggers in
   alphabetical name order; `categories` < `rules`) — the categories must exist
   first because each rule resolves its target `category_id` by the category's
   `name_key`.
2. **`categorization_rules` gains `name_key` + `is_default`, mirroring
   `categories`.** `name_key` is the stable i18n key for a seeded rule (NULL for
   user-authored rules); `is_default` flags seeded rows. A partial unique index
   `(user_id, name_key) where name_key is not null` makes the seed idempotent
   (re-running `ON CONFLICT DO NOTHING`) and matches the categories precedent.
   Display: the UI resolves `rules.defaults.<name_key>` when set, else shows the
   literal `name`.
3. **Each default rule is a single `description contains <token>` clause** over
   a distinct merchant token, all op `contains` (the matcher is
   case-insensitive). OR across merchants for one category = multiple rules
   (the AND-only model). Tokens are chosen to be specific enough not to
   false-positive.
4. **Priorities are explicit and distinct** (`100, 101, 102, …` in source
   order). Distinct priorities make precedence fully deterministic — no reliance
   on `created_at` ties — and let a more specific token outrank a generic one
   (`uber eats` → Restaurants is listed/numbered before `uber` → Transport).
   Defaults sit at priority ≥ 100 so any user rule (default priority 0) wins.
5. **Canonical source drives everything.** `lib/domain/rules/defaults.ts`
   (`DEFAULT_RULES`) is the single source of truth; the SQL seed mirrors it and
   the `rules.defaults.*` i18n catalog labels it. A test asserts referential
   integrity (every `categoryKey` ∈ `DEFAULT_CATEGORY_KEYS`), valid conditions
   (parse against `conditionsSchema`), unique keys, unique priorities, and
   i18n EN/ES parity — the guardrails against drift.

## Architecture

### 1. Canonical source — `lib/domain/rules/defaults.ts` (new)

```ts
export interface DefaultRule {
  key: string          // stable name_key + i18n key (rules.defaults.<key>)
  en: string           // literal `name` fallback persisted on the row
  categoryKey: string  // target category's name_key (∈ DEFAULT_CATEGORY_KEYS)
  contains: string     // the description substring to match (lower-cased compare)
  priority: number     // explicit, distinct; lower = higher precedence
}
export const DEFAULT_RULES: readonly DefaultRule[]
```

### 2. Schema — `lib/db/schema/categorization-rules.ts` + migration `0008`

Add `nameKey text` (nullable) and `isDefault boolean not null default false`;
add partial unique index `categorization_rules_user_name_key_uidx` on
`(user_id, name_key) where name_key is not null`. Migration `0008` (drizzle-kit
generate) is hand-extended with `seed_default_rules(uuid)` (resolves
`categoryKey` → the user's category id, builds the `conditions` jsonb with
`jsonb_build_array(jsonb_build_object('field','description','op','contains','value', token))`,
`ON CONFLICT (user_id, name_key) … DO NOTHING`) and the
`on_auth_user_created_seed_rules` trigger.

### 3. Validation — `lib/validation/categorization-rule.ts`

Add `name_key: z.string().nullable()` to `categorizationRuleRowSchema` (read
side); `toDomainRule` is unchanged (the domain `Rule` doesn't carry `name`).

### 4. i18n — `messages/{en,es}.json`

A `rules.defaults.<key>` label per default rule; the existing parity test
covers EN⇄ES.

### 5. Tests — `lib/domain/rules/defaults.test.ts`

Referential integrity, valid conditions, unique keys, unique priorities; plus
an i18n-sync assertion that every key has an EN+ES label (mirrors
`defaults.i18n.test.ts` for categories).

## Out of scope

- Rules CRUD UI / managing defaults — **P5-01**.
- On-demand re-categorization of existing rows — **P5-01** (P3-03 design).

## Verification

`npm run typecheck`, `npm run lint`, `npm test` green. `npm run db:migrate`
applies `0008`; on a fresh signup the default rules appear (after the default
categories), and importing a file mentioning a seeded merchant auto-categorizes.
