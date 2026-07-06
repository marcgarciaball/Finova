# Settings shell + Profile tab — design (P5-01, sub-project A)

**Date:** 2026-07-06
**Ticket:** P5-01 (first slice) — see PROGRESS.md Phase 5
**Status:** Draft for review

## Context & decomposition

P5-01 ("Settings: profile, base currency, manage categories & rules") bundles
four separable surfaces. It is decomposed into independent spec → plan →
implementation cycles:

- **A. Settings shell + Profile tab** — this spec.
- **B. Categories management tab** — CRUD over the category tree.
- **C. Rules management tab** — rules CRUD/enable/priority + wiring the pure
  cores already built and tested: `previewRuleMatches` (P3-06),
  `suggestRuleFromCorrection` (P3-05), apply-on-demand (P3-03 deferral).
- **D. Needs-review entry point (P3-07)** — transactions filter already
  supports `category=none`; D is surfacing it.

Build order: **A → C → B → D**. A is the foundation (the shell B and C slot
into); C delivers the most deferred value.

## Goal

Replace the `/protected/settings` placeholder with a tabbed settings screen
whose first tab (Profile) shows the signed-in email and lets the user change
their **base currency** — the value `getBaseCurrency()` already reads to
default the transaction form.

## Non-goals

- Display currency UI: nothing consumes `profiles.display_currency` until the
  FX source lands (P1-07 deferral).
- Locale / theme controls: both already live in the nav; the full i18n pass is
  P5-03. `profiles.locale` sync stays untouched.
- Categories / rules panels: sub-projects B and C. Their tabs render a small
  "coming soon" card so the shell ships whole.

## Architecture

Mirror the merged Datos screen exactly (URL-driven tabs, server-rendered
panels):

```
app/protected/settings/
  settings-tab.ts      pure: SettingsTab = 'profile' | 'categories' | 'rules'
                       parseSettingsTab(value) — default & malformed → 'profile'
  SettingsTabs.tsx     client SegmentedControl writing ?tab= (clone of DataTabs)
  page.tsx             reads searchParams.tab, renders the matching panel
  ProfilePanel.tsx     server component: email + base-currency form
  ProfileForm.tsx      client form (useActionState), select + save + inline error
  data.ts              getProfile(): RLS-scoped read of own profiles row
  actions.ts           updateBaseCurrency: server action, ActionResult
lib/domain/profile/
  currencies.ts        CURRENCY_OPTIONS: curated ISO-4217 codes (EUR, USD, GBP,
                       CHF to start) — pure constant + isSupportedCurrency()
lib/validation/profile.ts
  profileRowSchema     zod row schema (id, base_currency, display_currency,
                       locale, timestamps)
  updateBaseCurrencySchema  { baseCurrency: currencySchema ∩ supported list }
```

Rationale for the alternatives rejected: sub-routes
(`/settings/profile`, …) add nested-layout ceremony with no v1 gain; a single
scrolling page degrades once the rules UI (large) lands.

## Data flow

1. `page.tsx` → `requireUser()` → `parseSettingsTab(searchParams.tab)`.
2. Profile tab: `getProfile()` reads own `profiles` row via the Supabase
   server client (`maybeSingle`; missing row → defaults `{ base_currency:
   'EUR' }` — signup trigger normally guarantees the row).
3. `ProfileForm` posts to `updateBaseCurrency` (server action):
   `requireUser()` first; zod-validate; `upsert` own row keyed by
   `claims.sub` (never form data — upsert so a missing profile row, however
   unlikely, can still be saved; `profiles_insert_own` RLS allows it);
   discriminated `ActionResult`;
   `revalidatePath('/protected/settings')` and
   `revalidatePath('/protected/transactions')` (form default consumes it).
4. RLS remains the backstop (`profiles_update_own`), same belt-and-suspenders
   stance as accounts.

## Error handling

- Validation errors → field-level messages via `ActionResult` fieldErrors,
  rendered inline (AccountForm pattern).
- Supabase error → generic form-level error message, value unchanged.
- Unknown/unsupported currency posted → rejected by
  `updateBaseCurrencySchema` (server-side; the select constrains the client).

## i18n

New `settings` namespace in `messages/{en,es}.json`: title, tab labels,
profile section labels (`signedInAs`, `baseCurrency`, `baseCurrencyHelp`,
`save`, `saved`, error strings), `comingSoon` for the B/C placeholder cards.

## Testing

- `settings-tab.test.ts` — parse defaults, all three values, garbage.
- `currencies.test.ts` — non-empty, uppercase-ISO shape, EUR present, no dupes.
- `lib/validation/profile.test.ts` — row schema + update schema accept/reject.
- `ProfileForm.test.tsx` — jsdom: renders options, submits, shows inline error
  (NextIntlClientProvider wrapper, ExportFilters.test.tsx pattern).
- Read layer/action are thin composition: typecheck + browser pass (human).

## Definition of done

- `/protected/settings` shows tabs Profile / Categories / Rules; deep links
  (`?tab=rules`) server-render the right panel.
- Base currency saves, survives reload, and changes the transaction form's
  default currency.
- Suite green (`npm run test && npm run typecheck && npm run lint`); both
  locales complete.
