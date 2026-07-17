# P5-01 — Settings (Profile · Categories · Rules) — Design

**Date:** 2026-07-17
**Ticket:** P5-01 (Phase 5 — Hardening & Release)
**Branch:** `feat/component-foundation` (or a fresh `feat/settings` off it)
**Status:** Design approved; implementation pending.

> Outline spec (per the lean-plans convention): contracts, decisions, and file
> shape — not full code. Implementation is written once, in the plan.

## Goal

Give the user a real **Settings** surface that (a) sets profile preferences
(base/display currency; language & theme surfaced here too), (b) manages the
**category** tree (create/edit/delete, subcategories, icon/color), and (c)
manages **categorization rules** (full multi-clause CRUD, enable/disable,
priority, "test against your data" preview). This unlocks the deferred
management UIs from Phase 1.3 (custom categories) and Phase 1.4 (rules), plus
"make this a rule" (P3-05) on the transactions surface.

All the domain/validation groundwork already exists:
`lib/validation/category.ts`, `lib/validation/categorization-rule.ts`,
`lib/domain/rules/{match,preview,suggest,defaults}.ts`,
`lib/domain/categories/{icons,label,types}.ts`, and the `profiles` table with
`base_currency` / `display_currency` / `locale`. This ticket is almost entirely
the **server-action + UI layer** over them.

## Non-goals

- Account deletion / GDPR export (P5-02).
- Full i18n/a11y/perf passes (P5-03/04/06) beyond adding the new namespace with
  EN⇄ES parity.
- Base-currency FX consolidation (P1-07 — unchanged; still per-currency).
- Any new dashboard panel.

## Architecture

A route group with a shared tab layout, following the established
`app/protected/accounts/` CRUD pattern: `data.ts` = RLS-enforced reads via the
Supabase server client; `actions.ts` = `'use server'` mutations, `requireUser()`
first, owner from the JWT (never the form), returning a discriminated
`ActionResult`; client components own the forms via `useActionState`.

```
app/protected/settings/
  layout.tsx            # tab bar: Profile · Categories · Rules (active highlight)
  page.tsx              # Profile tab
  data.ts               # getProfile()
  actions.ts            # updateProfile()
  ProfileForm.tsx       # currency selects + reused Locale/Theme switchers
  categories/
    page.tsx
    data.ts             # listCategories() -> two-level tree
    actions.ts          # create/update/deleteCategory
    CategoryTree.tsx    # parents + nested children, add-subcategory affordance
    CategoryRow.tsx     # read/edit toggle, delete
    CategoryForm.tsx    # create+edit (name, kind, parent, icon, color)
    IconColorPicker.tsx # curated Lucide set + fixed palette
  rules/
    page.tsx
    data.ts             # listRules(), listTxnsForPreview()
    actions.ts          # create/update/delete/toggleRule, previewRule
    RuleList.tsx
    RuleRow.tsx         # summary + enable toggle + edit/delete
    RuleForm.tsx        # name, priority, target category, clauses, live preview
    ClauseBuilder.tsx   # add/remove clauses; field -> op -> value
    RulePreview.tsx     # match count + sample rows (previewRuleMatches)
```

Tabs are **real route segments** (`/settings`, `/settings/categories`,
`/settings/rules`) so each deep-links and loads independently, consistent with
the app's URL-driven convention. `layout.tsx` renders the tab bar; the active
tab is derived from the pathname.

## Section 1 — Profile tab

**Reads** (`data.ts#getProfile`): the caller's `profiles` row (RLS
`id = auth.uid()`); if somehow absent, treat as defaults (EUR/EUR/es).

**Action** (`actions.ts#updateProfile`): validate `{ baseCurrency,
displayCurrency }` against a new `updateProfileSchema` (ISO-4217:
`/^[A-Z]{3}$/`, matching the DB check), `update` the row, `revalidatePath`.
Returns `ActionResult`.

**UI** (`ProfileForm.tsx`): two currency `<select>`s (shared ISO-4217 option
list — a small `lib/domain/money/currencies.ts` constant if one doesn't already
exist; otherwise reuse). Language and theme are **reused** existing components
(`components/LocaleSwitcher.tsx`, `components/ThemeSwitcher.tsx`) surfaced in the
tab — no new logic; they persist via cookie / next-themes as they do in the
avatar menu today.

Currency change is a plain profile update — the dashboard already derives its
display currency from `profiles` + activity, so nothing downstream migrates.

## Section 2 — Categories tab

**Reads** (`data.ts#listCategories`): all owner categories, assembled into a
two-level tree (top-level parents each with a `children` array), each parsed via
`categoryRowSchema`. Sorted: parents by name, children by name.

**Validation change:** extend `createCategorySchema` / `updateCategorySchema`
with:
- `iconName`: optional, validated against the icon allowlist in
  `lib/domain/categories/icons.ts` (the same names `CategoryIcon` maps).
- `color`: optional, validated against a fixed brand-safe palette allowlist
  (new constant, e.g. `lib/domain/categories/colors.ts`) — reject arbitrary
  hex to keep the visual system coherent and avoid an injection surface.

**Actions** (`actions.ts`):
- `createCategory`: existing parent-ownership + same-kind + one-level-nesting
  checks (per the P1-03 notes), plus icon/color. `is_default=false`,
  `name_key=null`.
- `updateCategory`: same checks. **Default→custom conversion (unambiguous
  rule):** the server does not know the translated label, so conversion is
  driven by intent, not string comparison. For a default row (`name_key != null`)
  the `CategoryForm` shows the name as a read-only i18n label with an explicit
  **"Edit name"** affordance; `name` is included in the payload **only when the
  user opts into renaming**. Server rule: if `name` is present in the payload and
  the row has a non-null `name_key`, set `name_key = null` (it becomes custom).
  Icon/color-only edits omit `name`, so `name_key` is untouched. Custom rows
  (`name_key = null`) always send `name` normally.
- `deleteCategory`: hard delete; relies on existing FK behavior —
  `transactions.category_id` → **SET NULL** (rows un-categorize, preserved) and
  `categorization_rules.category_id` → **CASCADE** (a rule with no category
  can't act, so it's removed). The row's children (subcategories) also delete
  via the `parent_id ON DELETE CASCADE` self-ref; surface a confirm that names
  the consequence ("N transactions will become uncategorized; N rules removed").

**UI:** `CategoryTree` renders parents with nested children and an
"add subcategory" affordance under each parent; `CategoryRow` toggles
read/edit and holds delete; `CategoryForm` is create+edit (name, kind,
parent, `IconColorPicker`). Defaults render with their i18n label until renamed.

## Section 3 — Rules tab (full multi-clause builder)

**Reads** (`data.ts`):
- `listRules()`: owner rules ordered `priority asc, created_at asc` (the
  precedence the matcher relies on), parsed via `categorizationRuleRowSchema`;
  join category label for display.
- `listTxnsForPreview()`: a lightweight projection of the user's transactions
  (`description`, `amount_cents`, `account_id`) for the live preview, RLS-scoped.

**Actions** (`actions.ts`), reusing
`create/updateCategorizationRuleSchema`:
- `createRule` / `updateRule`: validate; `updateRule` applies the same
  default→custom name conversion as categories (rename clears `name_key`).
- `deleteRule`.
- `toggleRule(id, enabled)`: fast enable/disable path.
- `previewRule({ conditions })`: `requireUser()`, fetch
  `listTxnsForPreview()`, map to `MatchableTxn`, run the existing
  `previewRuleMatches` core, return `{ count, total, sample }`. Pure matching,
  no writes.

**UI:**
- `ClauseBuilder`: add/remove clauses (min 1, matching `conditionsSchema`).
  Each clause: pick `field` → the valid `op`s for that field → value input.
  - `description`: contains / equals / starts_with / regex (text).
  - `amount_cents`: lt / lte / gt / gte / eq, value entered in **major units**
    and converted to signed cents via the money module (`parseAmountToCents`);
    an "absolute value" toggle sets `absolute`.
  - `account_id`: eq, via an account picker.
  Clauses are AND-combined (the matcher's semantics).
- `RuleForm`: name, priority (int ≥ 0, default 0), target category `<select>`,
  the `ClauseBuilder`, and an embedded `RulePreview` that calls `previewRule`
  (debounced) as conditions change — "matches N of M transactions" + sample rows.
- `RuleList` / `RuleRow`: rule summary (readable clause description + target
  category + priority), enable toggle, edit/delete. Default rules render their
  i18n name until renamed.

## Section 4 — "Make this a rule" (transactions surface)

A small addition to `app/protected/transactions/`: on a transaction row (in the
recategorize flow), a **"Make a rule from this"** control that:
1. Calls the existing `suggestRuleFromCorrection({ description, categoryId })`
   core (P3-05) → a `createCategorizationRuleSchema`-valid draft (single
   `description contains <merchant token>` clause, priority 0).
2. Deep-links to `/settings/rules` with the draft **prefilled** in a new-rule
   form (via URL params or a short-lived draft passed through navigation).

The user reviews/edits before saving — no rule is created silently.

## Cross-cutting

- **i18n:** new `settings` namespace (with `settings.profile`,
  `settings.categories`, `settings.rules`) in `messages/{en,es}.json`; the
  existing `i18n-parity` test enforces EN⇄ES key parity.
- **Nav:** the Settings link already exists (avatar menu / nav); only the new
  in-page tab bar is added.
- **Migrations:** none expected — `categories.icon_name/color` and all
  `categorization_rules` columns already exist. Confirm during planning; if the
  color palette needs no DB change (it's app-layer validation), there is nothing
  to migrate.
- **Security:** every action `requireUser()` first; owner from the JWT
  `claims.sub`, never the form; all reads/writes go through the RLS-enforced
  Supabase server client (defense-in-depth with the existing default-deny RLS on
  `profiles` / `categories` / `categorization_rules`). Icon/color/currency are
  allowlist-validated (no arbitrary strings). Regex clause value stays capped at
  200 chars (existing schema) as a cheap ReDoS bound.

## Testing

- **Unit:** extended `createCategorySchema`/`updateCategorySchema` (icon/color
  allowlist accept/reject); new `updateProfileSchema` (ISO-4217); a pure
  clause-builder ↔ `conditions` round-trip helper (form state → validated
  `RuleConditions` and back), mirroring the import mapping-form tests.
- **Action logic:** default→custom name-conversion (categories and rules),
  parent-ownership rejection, delete-consequence behavior. Where an action is a
  thin validated wrapper over an RLS write, lean on the existing RLS suites
  (`tests/rls/categories.rls.test.ts`, `categorization-rules.rls.test.ts`)
  rather than duplicating isolation coverage.
- **Parity:** the i18n parity test covers the new namespace.
- **Gate (manual, in browser):** set currencies → dashboard reflects; create a
  custom category with icon/color → appears in the transaction category picker;
  rename a default → i18n label drops; delete a category → rows un-categorize;
  create a multi-clause rule → preview matches the expected rows → import/apply
  categorizes them; "make this a rule" prefills the rules form.

## Open items to confirm in planning

- Whether a shared ISO-4217 currency constant already exists (else add
  `lib/domain/money/currencies.ts`).
- Exact draft-passing mechanism for "make this a rule" (URL params vs. a
  transient store) — pick the simplest that survives a full page navigation.
- Whether default rules should be deletable in the same pass or read-only-name;
  current decision: same handling as categories (icon/color/priority editable,
  delete allowed, rename clears `name_key`).
