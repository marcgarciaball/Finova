# Settings Shell + Profile Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/protected/settings` placeholder with a tabbed settings screen (Profile / Categories / Rules) whose Profile tab shows the signed-in email and saves the user's base currency.

**Architecture:** Mirror the merged Datos screen exactly: a pure URL-tab parser, a client `SegmentedControl` tab switcher writing `?tab=`, and a server-rendered page that picks the panel. The Profile tab is a server panel (`getProfile()` read) plus a client `useActionState` form posting to an `updateBaseCurrency` server action (AccountForm pattern). Categories/Rules tabs render a "coming soon" card (sub-projects B/C).

**Tech Stack:** Next.js App Router (server components + server actions), Supabase (RLS-scoped server client), zod, next-intl, Vitest (+ jsdom / Testing Library for the form), Biome.

**Design spec:** `docs/superpowers/specs/2026-07-06-settings-shell-profile-design.md`

## Global Constraints

- Package manager is **npm**; linter/formatter is **Biome** (`npm run lint`). Full gate: `npm run test && npm run typecheck && npm run lint`.
- App name is **Finova**.
- Every server read/write starts with `requireUser()` and goes through the RLS-enforced Supabase server client (`@/lib/supabase/server`). Owner id always comes from verified JWT `claims.sub`, never from form data.
- Server actions return the discriminated `ActionResult` shape: `{ ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> }`.
- i18n: every new user-facing string exists in **both** `messages/en.json` and `messages/es.json`.
- Do NOT touch `profiles.display_currency` or `profiles.locale` (non-goals; locale sync exists elsewhere).
- No new dependencies.
- The dev server / browser verification cannot be run by the agent (sandbox denies socket listen); hand those steps to a human.

---

### Task 1: Pure tab parser `parseSettingsTab`

**Files:**
- Create: `app/protected/settings/settings-tab.ts`
- Test: `app/protected/settings/settings-tab.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type SettingsTab = 'profile' | 'categories' | 'rules'` and `parseSettingsTab(value: string | undefined): SettingsTab` (default & malformed → `'profile'`). Task 6's `page.tsx` and `SettingsTabs.tsx` import both.

- [ ] **Step 1: Write the failing test**

Create `app/protected/settings/settings-tab.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseSettingsTab } from './settings-tab'

describe('parseSettingsTab', () => {
  it('defaults to profile when the param is missing', () => {
    expect(parseSettingsTab(undefined)).toBe('profile')
  })

  it('accepts each known tab', () => {
    expect(parseSettingsTab('profile')).toBe('profile')
    expect(parseSettingsTab('categories')).toBe('categories')
    expect(parseSettingsTab('rules')).toBe('rules')
  })

  it('falls back to profile on garbage', () => {
    expect(parseSettingsTab('')).toBe('profile')
    expect(parseSettingsTab('RULES')).toBe('profile')
    expect(parseSettingsTab('nonsense')).toBe('profile')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/protected/settings/settings-tab.test.ts`
Expected: FAIL — cannot resolve `./settings-tab`.

- [ ] **Step 3: Implement**

Create `app/protected/settings/settings-tab.ts` (clone of `app/protected/data/data-tab.ts` with three values):

```ts
const TABS = ['profile', 'categories', 'rules'] as const
export type SettingsTab = (typeof TABS)[number]

export function parseSettingsTab(value: string | undefined): SettingsTab {
  return (TABS as readonly string[]).includes(value ?? '')
    ? (value as SettingsTab)
    : 'profile'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/protected/settings/settings-tab.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/protected/settings/settings-tab.ts app/protected/settings/settings-tab.test.ts
git commit -m "feat(settings): pure settings tab parser"
```

---

### Task 2: Curated currency list `CURRENCY_OPTIONS`

**Files:**
- Create: `lib/domain/profile/currencies.ts`
- Test: `lib/domain/profile/currencies.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `CURRENCY_OPTIONS: readonly ['EUR', 'USD', 'GBP', 'CHF']` and `isSupportedCurrency(code: string): boolean`. Task 3's schema and Task 5's form import these.

- [ ] **Step 1: Write the failing test**

Create `lib/domain/profile/currencies.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { CURRENCY_OPTIONS, isSupportedCurrency } from './currencies'

describe('CURRENCY_OPTIONS', () => {
  it('is non-empty and includes EUR', () => {
    expect(CURRENCY_OPTIONS.length).toBeGreaterThan(0)
    expect(CURRENCY_OPTIONS).toContain('EUR')
  })

  it('contains only uppercase ISO-4217-shaped codes', () => {
    for (const code of CURRENCY_OPTIONS) {
      expect(code).toMatch(/^[A-Z]{3}$/)
    }
  })

  it('has no duplicates', () => {
    expect(new Set(CURRENCY_OPTIONS).size).toBe(CURRENCY_OPTIONS.length)
  })
})

describe('isSupportedCurrency', () => {
  it('accepts every option', () => {
    for (const code of CURRENCY_OPTIONS) {
      expect(isSupportedCurrency(code)).toBe(true)
    }
  })

  it('rejects codes outside the curated list', () => {
    expect(isSupportedCurrency('JPY')).toBe(false)
    expect(isSupportedCurrency('eur')).toBe(false)
    expect(isSupportedCurrency('')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/profile/currencies.test.ts`
Expected: FAIL — cannot resolve `./currencies`.

- [ ] **Step 3: Implement**

Create `lib/domain/profile/currencies.ts`:

```ts
/**
 * Curated base-currency choices for the Profile settings form (P5-01 A).
 * Deliberately small: expanding it is a one-line change, and the FX work
 * (P1-07 deferral) will revisit currency coverage anyway.
 */
export const CURRENCY_OPTIONS = ['EUR', 'USD', 'GBP', 'CHF'] as const

export type SupportedCurrency = (typeof CURRENCY_OPTIONS)[number]

export function isSupportedCurrency(
  code: string
): code is SupportedCurrency {
  return (CURRENCY_OPTIONS as readonly string[]).includes(code)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/domain/profile/currencies.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/domain/profile/currencies.ts lib/domain/profile/currencies.test.ts
git commit -m "feat(profile): curated supported-currency list"
```

---

### Task 3: Profile validation schemas

**Files:**
- Create: `lib/validation/profile.ts`
- Test: `lib/validation/profile.test.ts`

**Interfaces:**
- Consumes: `currencySchema` from `@/lib/validation/account` (`z.string().regex(/^[A-Z]{3}$/, 'invalidCurrency')`), `isSupportedCurrency` from `@/lib/domain/profile/currencies` (Task 2).
- Produces: `profileRowSchema` (parses a Supabase `profiles` row), `type ProfileRow = z.infer<typeof profileRowSchema>`, `updateBaseCurrencySchema` (`{ baseCurrency }`, message key `unsupportedCurrency` for known-shape-but-uncurated codes). Task 4 imports all three.

The `profiles` table (drizzle/0000_broad_raider.sql): `id uuid PK`, `base_currency text`, `display_currency text`, `locale text ('es'|'en')`, `created_at`, `updated_at`.

- [ ] **Step 1: Write the failing test**

Create `lib/validation/profile.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { profileRowSchema, updateBaseCurrencySchema } from './profile'

const row = {
  id: '11111111-1111-4111-8111-111111111111',
  base_currency: 'EUR',
  display_currency: 'EUR',
  locale: 'es',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('profileRowSchema', () => {
  it('accepts a well-formed row', () => {
    expect(profileRowSchema.parse(row)).toEqual(row)
  })

  it('rejects a malformed currency', () => {
    expect(
      profileRowSchema.safeParse({ ...row, base_currency: 'euro' }).success
    ).toBe(false)
  })

  it('rejects a missing id', () => {
    expect(profileRowSchema.safeParse({ ...row, id: '' }).success).toBe(false)
  })
})

describe('updateBaseCurrencySchema', () => {
  it('accepts a supported currency', () => {
    const parsed = updateBaseCurrencySchema.parse({ baseCurrency: 'USD' })
    expect(parsed.baseCurrency).toBe('USD')
  })

  it('rejects a malformed code with invalidCurrency', () => {
    const result = updateBaseCurrencySchema.safeParse({ baseCurrency: 'usd' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('invalidCurrency')
    }
  })

  it('rejects a well-formed but unsupported code with unsupportedCurrency', () => {
    const result = updateBaseCurrencySchema.safeParse({ baseCurrency: 'JPY' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('unsupportedCurrency')
    }
  })

  it('rejects a missing value', () => {
    expect(updateBaseCurrencySchema.safeParse({}).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/validation/profile.test.ts`
Expected: FAIL — cannot resolve `./profile`.

- [ ] **Step 3: Implement**

Create `lib/validation/profile.ts`:

```ts
import { z } from 'zod'
import { isSupportedCurrency } from '@/lib/domain/profile/currencies'
import { currencySchema } from '@/lib/validation/account'

/**
 * Profile validation (P5-01 A).
 *
 * `profileRowSchema` is the single source of truth for the runtime shape of a
 * Supabase `profiles` row, parsed at the data boundary (accountRowSchema
 * pattern). `updateBaseCurrencySchema` validates the Profile form's only
 * input; the curated-list refinement is the server-side backstop for the
 * select's client-side constraint.
 */

export const profileRowSchema = z.object({
  id: z.string().min(1),
  base_currency: currencySchema,
  display_currency: currencySchema,
  locale: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type ProfileRow = z.infer<typeof profileRowSchema>

export const updateBaseCurrencySchema = z.object({
  baseCurrency: currencySchema.refine(isSupportedCurrency, {
    message: 'unsupportedCurrency',
  }),
})

export type UpdateBaseCurrencyInput = z.infer<typeof updateBaseCurrencySchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/validation/profile.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/validation/profile.ts lib/validation/profile.test.ts
git commit -m "feat(profile): row + update-base-currency validation schemas"
```

---

### Task 4: Read layer and `updateBaseCurrency` server action

**Files:**
- Create: `app/protected/settings/data.ts`
- Create: `app/protected/settings/actions.ts`

**Interfaces:**
- Consumes: `requireUser` from `@/lib/auth/require-user`, `createClient` from `@/lib/supabase/server`, `profileRowSchema` / `updateBaseCurrencySchema` from `@/lib/validation/profile` (Task 3).
- Produces:
  - `getProfile(): Promise<ProfileSettings>` where `export interface ProfileSettings { baseCurrency: string }` — Task 5's `ProfilePanel` calls it.
  - `updateBaseCurrency(prev: ActionResult | undefined, formData: FormData): Promise<ActionResult>` and `export type ActionResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> }` — Task 5's `ProfilePanel` passes the action into `ProfileForm`.

These are thin composition over Supabase (per spec: verified by typecheck + the human browser pass in Task 7 — no unit tests mocking Supabase).

- [ ] **Step 1: Create the read layer**

Create `app/protected/settings/data.ts`:

```ts
import 'server-only'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import { profileRowSchema } from '@/lib/validation/profile'

/** What the Profile tab needs from the user's `profiles` row. */
export interface ProfileSettings {
  baseCurrency: string
}

/**
 * RLS-scoped read of the caller's own `profiles` row. The signup trigger
 * normally guarantees the row exists; if it somehow doesn't, fall back to the
 * schema default ('EUR') instead of failing the page.
 */
export async function getProfile(): Promise<ProfileSettings> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  if (!data) {
    return { baseCurrency: 'EUR' }
  }
  const row = profileRowSchema.parse(data)
  return { baseCurrency: row.base_currency }
}
```

- [ ] **Step 2: Create the server action**

Create `app/protected/settings/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import { updateBaseCurrencySchema } from '@/lib/validation/profile'

/**
 * Server action for the Profile settings tab (P5-01 A).
 *
 * `requireUser()` first; the row is keyed by verified `claims.sub`, never form
 * data. Upsert (not update) so a missing profile row — however unlikely, the
 * signup trigger creates it — can still be saved; `profiles_insert_own` RLS
 * allows it, and `profiles_update_own` is the backstop for the update path.
 */

const SETTINGS_PATH = '/protected/settings'

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

/** First message per field, for inline form errors. */
function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !(key in out)) {
      out[key] = issue.message
    }
  }
  return out
}

const VALIDATION_FAILED = 'validationFailed'
const UNEXPECTED = 'unexpected'

export async function updateBaseCurrency(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const claims = await requireUser()

  const parsed = updateBaseCurrencySchema.safeParse({
    baseCurrency: formData.get('baseCurrency'),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: VALIDATION_FAILED,
      fieldErrors: toFieldErrors(parsed.error),
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('profiles').upsert({
    id: claims.sub,
    base_currency: parsed.data.baseCurrency,
  })
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }

  revalidatePath(SETTINGS_PATH)
  // The transaction form defaults its currency from getBaseCurrency().
  revalidatePath('/protected/transactions')
  return { ok: true }
}
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add app/protected/settings/data.ts app/protected/settings/actions.ts
git commit -m "feat(settings): profile read layer + updateBaseCurrency action"
```

---

### Task 5: Messages + `ProfileForm` + `ProfilePanel`

**Files:**
- Modify: `messages/en.json` (add `settings` namespace)
- Modify: `messages/es.json` (add `settings` namespace)
- Create: `app/protected/settings/ProfileForm.tsx`
- Create: `app/protected/settings/ProfilePanel.tsx`
- Test: `app/protected/settings/ProfileForm.test.tsx`

**Interfaces:**
- Consumes: `CURRENCY_OPTIONS` (Task 2), `ActionResult` + `updateBaseCurrency` (Task 4), `getProfile` (Task 4), UI primitives `Button`/`Label`/`GlassCard` from `@/components/ui/*`.
- Produces:
  - `ProfileForm({ baseCurrency, action }: { baseCurrency: string; action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult> })` — client component. The action is **injected as a prop** (not imported) so the jsdom test can stub it without pulling `next/cache`/the Supabase server client into the test environment.
  - `ProfilePanel({ email }: { email: string })` — async server component; Task 6's `page.tsx` renders it.

- [ ] **Step 1: Add messages**

In `messages/en.json`, add a top-level `settings` namespace (alongside `data`, `accounts`, …):

```json
"settings": {
  "title": "Settings",
  "tabs": {
    "profile": "Profile",
    "categories": "Categories",
    "rules": "Rules"
  },
  "signedInAs": "Signed in as {email}",
  "baseCurrency": "Base currency",
  "baseCurrencyHelp": "Default currency for new transactions and accounts.",
  "save": "Save",
  "saved": "Saved",
  "comingSoon": "This section is coming soon.",
  "errors": {
    "invalidCurrency": "Enter a valid currency code.",
    "unsupportedCurrency": "That currency isn't supported yet.",
    "invalid": "Invalid value.",
    "unexpected": "Something went wrong. Your change was not saved."
  }
}
```

In `messages/es.json`, the same keys:

```json
"settings": {
  "title": "Ajustes",
  "tabs": {
    "profile": "Perfil",
    "categories": "Categorías",
    "rules": "Reglas"
  },
  "signedInAs": "Sesión iniciada como {email}",
  "baseCurrency": "Moneda base",
  "baseCurrencyHelp": "Moneda por defecto para nuevas transacciones y cuentas.",
  "save": "Guardar",
  "saved": "Guardado",
  "comingSoon": "Esta sección estará disponible próximamente.",
  "errors": {
    "invalidCurrency": "Introduce un código de moneda válido.",
    "unsupportedCurrency": "Esa moneda aún no está disponible.",
    "invalid": "Valor no válido.",
    "unexpected": "Algo ha ido mal. El cambio no se ha guardado."
  }
}
```

- [ ] **Step 2: Write the failing component test**

Create `app/protected/settings/ProfileForm.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import en from '@/messages/en.json'
import type { ActionResult } from './actions'
import { ProfileForm } from './ProfileForm'

function renderForm(
  action: (
    prev: ActionResult | undefined,
    formData: FormData
  ) => Promise<ActionResult>,
  baseCurrency = 'EUR'
) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ProfileForm baseCurrency={baseCurrency} action={action} />
    </NextIntlClientProvider>
  )
}

describe('ProfileForm', () => {
  it('renders every curated currency and preselects the current one', () => {
    renderForm(vi.fn(async () => ({ ok: true as const })), 'GBP')
    const select = screen.getByLabelText('Base currency') as HTMLSelectElement
    const values = Array.from(select.options).map((o) => o.value)
    expect(values).toEqual(['EUR', 'USD', 'GBP', 'CHF'])
    expect(select.value).toBe('GBP')
  })

  it('submits the selected currency and shows the saved confirmation', async () => {
    const action = vi.fn(async () => ({ ok: true as const }))
    renderForm(action)
    fireEvent.change(screen.getByLabelText('Base currency'), {
      target: { value: 'USD' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeInTheDocument()
    })
    const formData = action.mock.calls[0]?.[1] as FormData
    expect(formData.get('baseCurrency')).toBe('USD')
  })

  it('shows an inline field error from the action', async () => {
    const action = vi.fn(async () => ({
      ok: false as const,
      error: 'validationFailed',
      fieldErrors: { baseCurrency: 'unsupportedCurrency' },
    }))
    renderForm(action)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(
        screen.getByText("That currency isn't supported yet.")
      ).toBeInTheDocument()
    })
  })

  it('shows a form-level error when the save fails unexpectedly', async () => {
    const action = vi.fn(async () => ({
      ok: false as const,
      error: 'unexpected',
    }))
    renderForm(action)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(
        screen.getByText('Something went wrong. Your change was not saved.')
      ).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run app/protected/settings/ProfileForm.test.tsx`
Expected: FAIL — cannot resolve `./ProfileForm`.

- [ ] **Step 4: Implement `ProfileForm`**

Create `app/protected/settings/ProfileForm.tsx`:

```tsx
'use client'

import { useTranslations } from 'next-intl'
import { useActionState } from 'react'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { CURRENCY_OPTIONS } from '@/lib/domain/profile/currencies'
import type { ActionResult } from './actions'

/** Validation message keys the action can emit for the currency field. */
const KNOWN_ERROR_KEYS = new Set(['invalidCurrency', 'unsupportedCurrency'])

export function ProfileForm({
  baseCurrency,
  action,
}: {
  baseCurrency: string
  action: (
    prev: ActionResult | undefined,
    formData: FormData
  ) => Promise<ActionResult>
}) {
  const t = useTranslations('settings')
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined)

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined
  const currencyErrorKey = fieldErrors?.baseCurrency
  const currencyError = currencyErrorKey
    ? KNOWN_ERROR_KEYS.has(currencyErrorKey)
      ? t(`errors.${currencyErrorKey}`)
      : t('errors.invalid')
    : undefined
  const formError =
    state && !state.ok && !fieldErrors ? t('errors.unexpected') : undefined

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-base-currency">{t('baseCurrency')}</Label>
        <select
          id="profile-base-currency"
          name="baseCurrency"
          defaultValue={baseCurrency}
          className="h-11 w-full max-w-xs rounded-2xl border border-glass-line bg-glass px-4 py-2 text-ink text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {CURRENCY_OPTIONS.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <p className="text-ink-soft text-xs">{t('baseCurrencyHelp')}</p>
        {currencyError ? (
          <p className="text-neg text-xs">{currencyError}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {t('save')}
        </Button>
        {state?.ok ? <p className="text-ink-soft text-sm">{t('saved')}</p> : null}
        {formError ? <p className="text-neg text-sm">{formError}</p> : null}
      </div>
    </form>
  )
}
```

- [ ] **Step 5: Implement `ProfilePanel`**

Create `app/protected/settings/ProfilePanel.tsx`:

```tsx
import { getTranslations } from 'next-intl/server'
import { GlassCard } from '@/components/ui/GlassCard'
import { updateBaseCurrency } from './actions'
import { getProfile } from './data'
import { ProfileForm } from './ProfileForm'

/**
 * Profile tab: signed-in identity + base-currency form. The server action is
 * passed down as a prop so ProfileForm stays testable in jsdom.
 */
export async function ProfilePanel({ email }: { email: string }) {
  const [t, profile] = await Promise.all([
    getTranslations('settings'),
    getProfile(),
  ])

  return (
    <GlassCard className="flex flex-col gap-4">
      <p className="text-ink text-sm">{t('signedInAs', { email })}</p>
      <ProfileForm
        baseCurrency={profile.baseCurrency}
        action={updateBaseCurrency}
      />
    </GlassCard>
  )
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run app/protected/settings/ProfileForm.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add messages/en.json messages/es.json app/protected/settings/ProfileForm.tsx app/protected/settings/ProfilePanel.tsx app/protected/settings/ProfileForm.test.tsx
git commit -m "feat(settings): profile panel with base-currency form"
```

---

### Task 6: `SettingsTabs` + tabbed `page.tsx`

**Files:**
- Create: `app/protected/settings/SettingsTabs.tsx`
- Modify: `app/protected/settings/page.tsx` (full rewrite of the placeholder)
- Modify: `messages/en.json` (remove the now-unused `protected` namespace)
- Modify: `messages/es.json` (remove the now-unused `protected` namespace)

**Interfaces:**
- Consumes: `SettingsTab` / `parseSettingsTab` (Task 1), `ProfilePanel` (Task 5), `SegmentedControl` from `@/components/ui/SegmentedControl`, `requireUser`, `GlassCard`.
- Produces: the shipped `/protected/settings` route. Sub-projects B/C will later replace the coming-soon branch per tab.

- [ ] **Step 1: Implement `SettingsTabs`**

Create `app/protected/settings/SettingsTabs.tsx` (clone of `app/protected/data/DataTabs.tsx` with three options):

```tsx
'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import type { SettingsTab } from './settings-tab'

/**
 * Tab switcher for the settings screen (P5-01 A). URL-driven (`?tab=`) so each
 * tab is a shareable, server-rendered view — same pattern as `DataTabs`.
 */
export function SettingsTabs({
  value,
  ariaLabel,
  profileLabel,
  categoriesLabel,
  rulesLabel,
}: {
  value: SettingsTab
  ariaLabel: string
  profileLabel: string
  categoriesLabel: string
  rulesLabel: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const options = [
    { value: 'profile', label: profileLabel },
    { value: 'categories', label: categoriesLabel },
    { value: 'rules', label: rulesLabel },
  ]

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams)
    params.set('tab', next)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <SegmentedControl
      aria-label={ariaLabel}
      options={options}
      value={value}
      onValueChange={onChange}
    />
  )
}
```

- [ ] **Step 2: Rewrite `page.tsx`**

Replace the entire contents of `app/protected/settings/page.tsx`:

```tsx
import { getTranslations } from 'next-intl/server'
import { GlassCard } from '@/components/ui/GlassCard'
import { requireUser } from '@/lib/auth/require-user'
import { ProfilePanel } from './ProfilePanel'
import { parseSettingsTab } from './settings-tab'
import { SettingsTabs } from './SettingsTabs'

/**
 * Tabbed settings screen (P5-01 A), reachable from the avatar menu. Profile is
 * live; Categories and Rules are placeholders until sub-projects B and C land.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const claims = await requireUser()
  const tab = parseSettingsTab((await searchParams).tab)
  const t = await getTranslations('settings')
  const email = typeof claims.email === 'string' ? claims.email : ''

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-bold text-2xl">{t('title')}</h1>
        <SettingsTabs
          value={tab}
          ariaLabel={t('title')}
          profileLabel={t('tabs.profile')}
          categoriesLabel={t('tabs.categories')}
          rulesLabel={t('tabs.rules')}
        />
      </div>

      {tab === 'profile' ? (
        <ProfilePanel email={email} />
      ) : (
        <GlassCard>
          <p className="text-ink-soft text-sm">{t('comingSoon')}</p>
        </GlassCard>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Remove the dead `protected` namespace**

The old placeholder was the only consumer of the `protected` message namespace (verify: `grep -rn "getTranslations('protected')\|useTranslations('protected')" app components lib` must return nothing after Step 2). Delete the whole `"protected": { ... }` block from **both** `messages/en.json` and `messages/es.json`.

- [ ] **Step 4: Verify**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add app/protected/settings/SettingsTabs.tsx app/protected/settings/page.tsx messages/en.json messages/es.json
git commit -m "feat(settings): tabbed settings shell with profile tab"
```

---

### Task 7: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full suite**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 2: Exercise the running app** (human — sandbox blocks the dev server)

Start `npm run dev`, sign in, open **Settings** from the avatar menu and verify:
- Tabs Profile / Categories / Rules render; Categories and Rules show the coming-soon card.
- Deep link `/protected/settings?tab=rules` server-renders the Rules placeholder directly.
- Profile shows the signed-in email; the currency select offers EUR/USD/GBP/CHF with the current value preselected.
- Changing to USD and saving shows "Saved"; a reload still shows USD.
- **Transactions → New transaction** now defaults its currency to USD (then switch back to EUR).
- Switch locale to Spanish: title "Ajustes", tabs "Perfil / Categorías / Reglas", form labels in Spanish.
