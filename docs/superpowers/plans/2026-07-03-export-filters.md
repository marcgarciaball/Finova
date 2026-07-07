# Export Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user filter exports (date range presets + custom, single category, single account) before downloading the CSV ledger or JSON bundle from the Datos → Export tab.

**Architecture:** Reuse the transactions filter domain end-to-end: the export UI builds the same query params the transactions page uses (`from`, `to`, `account`, `category`), the export route handlers parse them with the existing `parseFilters`, and both the transactions list and the export read layer apply them through a shared `applyFilters` PostgREST builder (hoisted out of the transactions page's data layer). In the JSON bundle only transactions are filtered; accounts and categories always export in full.

**Tech Stack:** Next.js App Router (route handlers + server/client components), Supabase PostgREST, zod, next-intl, vitest + @testing-library/react, Biome.

**Spec:** `docs/superpowers/specs/2026-07-03-export-filters-design.md`

## Global Constraints

- Query param names are exactly those of the transactions page: `from`, `to`, `account`, `category` (plus `type`/`q` accepted for free via `parseFilters` — no UI for them).
- Invalid params are silently dropped (never a 400) — same behavior as the transactions page.
- Date presets (local time, `to` = today): *All time* = no from/to; *This month* = 1st of current month; *Last 3 months* = 1st of the month two months before the current one; *This year* = January 1st.
- Filenames gain a `-filtered` suffix only when at least one filter is active.
- JSON `meta.filters` appears only when at least one filter is active, and records only active keys.
- Verify commands: `npm run test`, `npm run typecheck`, `npm run lint` (Biome).
- All user-facing copy goes through next-intl; add both `messages/en.json` and `messages/es.json` keys.
- Commit after each task. Note: the agent sandbox blocks git writes in this repo — if `git commit` fails with a permission error, leave the changes staged/described and continue; the human commits.

---

### Task 1: Hoist `applyFilters` into the transactions domain

Today `applyFilters` is a private function in `app/protected/transactions/data.ts:31-70`. Move it (verbatim behavior) to a domain module with unit tests so the export read layer can share it.

**Files:**
- Create: `lib/domain/transactions/apply-filters.ts`
- Create: `lib/domain/transactions/apply-filters.test.ts`
- Modify: `app/protected/transactions/data.ts` (delete the local function, import the shared one)

**Interfaces:**
- Consumes: `TransactionFilters`, `UNCATEGORIZED`, `EMPTY_FILTERS` from `lib/domain/transactions/filters.ts` (existing).
- Produces: `applyFilters<Q extends Record<string, any>>(query: Q, filters: TransactionFilters): Q` exported from `@/lib/domain/transactions/apply-filters` — used by Task 4.

- [ ] **Step 1: Write the failing test**

Create `lib/domain/transactions/apply-filters.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { applyFilters } from './apply-filters'
import { EMPTY_FILTERS, UNCATEGORIZED } from './filters'

/** Chainable stub that records every builder call. */
function fakeQuery() {
  const calls: Array<[string, ...unknown[]]> = []
  // biome-ignore lint/suspicious/noExplicitAny: test stub for the PostgREST chain
  const q: any = {}
  for (const m of ['eq', 'is', 'gte', 'lte', 'lt', 'ilike'] as const) {
    q[m] = (...args: unknown[]) => {
      calls.push([m, ...args])
      return q
    }
  }
  return { q, calls }
}

describe('applyFilters', () => {
  it('applies nothing for empty filters', () => {
    const { q, calls } = fakeQuery()
    applyFilters(q, EMPTY_FILTERS)
    expect(calls).toEqual([])
  })

  it('filters by account and category ids', () => {
    const { q, calls } = fakeQuery()
    applyFilters(q, { ...EMPTY_FILTERS, accountId: 'acc-1', categoryId: 'cat-1' })
    expect(calls).toEqual([
      ['eq', 'account_id', 'acc-1'],
      ['eq', 'category_id', 'cat-1'],
    ])
  })

  it('maps the uncategorized sentinel to IS NULL', () => {
    const { q, calls } = fakeQuery()
    applyFilters(q, { ...EMPTY_FILTERS, categoryId: UNCATEGORIZED })
    expect(calls).toEqual([['is', 'category_id', null]])
  })

  it('applies inclusive UTC date bounds', () => {
    const { q, calls } = fakeQuery()
    applyFilters(q, { ...EMPTY_FILTERS, from: '2026-01-01', to: '2026-01-31' })
    expect(calls).toEqual([
      ['gte', 'occurred_at', '2026-01-01T00:00:00Z'],
      ['lte', 'occurred_at', '2026-01-31T23:59:59.999Z'],
    ])
  })

  it('escapes ilike wildcards in the search term', () => {
    const { q, calls } = fakeQuery()
    applyFilters(q, { ...EMPTY_FILTERS, q: '100%_off' })
    expect(calls).toEqual([['ilike', 'description', '%100\\%\\_off%']])
  })

  it('maps the expense type to non-transfer negative amounts', () => {
    const { q, calls } = fakeQuery()
    applyFilters(q, { ...EMPTY_FILTERS, type: 'expense' })
    expect(calls).toEqual([
      ['eq', 'is_transfer', false],
      ['lt', 'amount_cents', 0],
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/transactions/apply-filters.test.ts`
Expected: FAIL — cannot resolve `./apply-filters`.

- [ ] **Step 3: Create the module by moving the function**

Create `lib/domain/transactions/apply-filters.ts` with the function **moved verbatim** from `app/protected/transactions/data.ts:26-70` (including its doc comment and biome-ignore), plus imports and `export`:

```ts
import {
  type TransactionFilters,
  UNCATEGORIZED,
} from '@/lib/domain/transactions/filters'

/**
 * Apply the URL-derived filters to a PostgREST query. Shared by the
 * transactions list, its totals query, and the export read layer so all
 * callers always agree on what "matching" means. The builder is loosely
 * typed: PostgREST's self-referential chain type overflows a precise generic
 * here, and the result is zod-validated downstream regardless.
 */
// biome-ignore lint/suspicious/noExplicitAny: PostgREST builder chain type is self-referential
export function applyFilters<Q extends Record<string, any>>(
  query: Q,
  filters: TransactionFilters
): Q {
  let q = query
  if (filters.accountId) {
    q = q.eq('account_id', filters.accountId)
  }
  if (filters.categoryId === UNCATEGORIZED) {
    q = q.is('category_id', null)
  } else if (filters.categoryId) {
    q = q.eq('category_id', filters.categoryId)
  }
  switch (filters.type) {
    case 'income':
      q = q.eq('is_transfer', false).gte('amount_cents', 0)
      break
    case 'expense':
      q = q.eq('is_transfer', false).lt('amount_cents', 0)
      break
    case 'transfer':
      q = q.eq('is_transfer', true)
      break
    default:
      break
  }
  if (filters.from) {
    q = q.gte('occurred_at', `${filters.from}T00:00:00Z`)
  }
  if (filters.to) {
    // Inclusive upper bound: anything on the `to` day, up to end of day UTC.
    q = q.lte('occurred_at', `${filters.to}T23:59:59.999Z`)
  }
  if (filters.q) {
    // Escape PostgREST `ilike` wildcards in user input before wrapping.
    const term = filters.q.replace(/[%_]/g, (m) => `\\${m}`)
    q = q.ilike('description', `%${term}%`)
  }
  return q
}
```

Then in `app/protected/transactions/data.ts`:
- Delete the local `applyFilters` function and its doc comment (lines 26-70).
- Add `import { applyFilters } from '@/lib/domain/transactions/apply-filters'`.
- Remove `UNCATEGORIZED` from the `filters` import if it is now unused there (check with typecheck/lint).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/domain/transactions/apply-filters.test.ts && npm run typecheck`
Expected: all tests PASS, typecheck clean.

- [ ] **Step 5: Run the full suite and lint**

Run: `npm run test && npm run lint`
Expected: PASS (no other caller knew about the private function).

- [ ] **Step 6: Commit**

```bash
git add lib/domain/transactions/apply-filters.ts lib/domain/transactions/apply-filters.test.ts app/protected/transactions/data.ts
git commit -m "refactor(transactions): hoist applyFilters into domain for reuse"
```

---

### Task 2: Preset date-range helper

Pure helper that turns a preset key + "today" into a `{from, to}` pair of `YYYY-MM-DD` strings (local time).

**Files:**
- Create: `lib/domain/export/presets.ts`
- Create: `lib/domain/export/presets.test.ts`

**Interfaces:**
- Produces (used by Task 5):
  - `type ExportPreset = 'all' | 'month' | 'quarter' | 'year'`
  - `const EXPORT_PRESETS: readonly ExportPreset[]`
  - `presetRange(preset: ExportPreset, today: Date): { from: string | null; to: string | null }`

- [ ] **Step 1: Write the failing test**

Create `lib/domain/export/presets.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { presetRange } from './presets'

// Fixed "today": July 3, 2026 (month index 6), local time.
const TODAY = new Date(2026, 6, 3)

describe('presetRange', () => {
  it('all time has no bounds', () => {
    expect(presetRange('all', TODAY)).toEqual({ from: null, to: null })
  })

  it('this month starts on the 1st of the current month', () => {
    expect(presetRange('month', TODAY)).toEqual({
      from: '2026-07-01',
      to: '2026-07-03',
    })
  })

  it('last 3 months spans three calendar months including the current', () => {
    expect(presetRange('quarter', TODAY)).toEqual({
      from: '2026-05-01',
      to: '2026-07-03',
    })
  })

  it('last 3 months rolls over a year boundary', () => {
    expect(presetRange('quarter', new Date(2026, 0, 15))).toEqual({
      from: '2025-11-01',
      to: '2026-01-15',
    })
  })

  it('this year starts on January 1st', () => {
    expect(presetRange('year', TODAY)).toEqual({
      from: '2026-01-01',
      to: '2026-07-03',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/export/presets.test.ts`
Expected: FAIL — cannot resolve `./presets`.

- [ ] **Step 3: Implement**

Create `lib/domain/export/presets.ts`:

```ts
/**
 * Export date-range presets (export filters spec, 2026-07-03). Pure: the
 * caller passes "today" so this never reads the clock, keeping it testable
 * against fixed dates. Dates are local-time `YYYY-MM-DD`, matching what the
 * `<input type="date">` controls and the `from`/`to` query params carry.
 */

export const EXPORT_PRESETS = ['all', 'month', 'quarter', 'year'] as const
export type ExportPreset = (typeof EXPORT_PRESETS)[number]

export interface PresetRange {
  from: string | null
  to: string | null
}

const iso = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** The `{from, to}` bounds for a preset, given "today" (local time). */
export function presetRange(preset: ExportPreset, today: Date): PresetRange {
  const to = iso(today)
  switch (preset) {
    case 'all':
      return { from: null, to: null }
    case 'month':
      return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to }
    case 'quarter':
      // Three calendar months including the current one; Date normalizes
      // negative month indexes across the year boundary.
      return {
        from: iso(new Date(today.getFullYear(), today.getMonth() - 2, 1)),
        to,
      }
    case 'year':
      return { from: iso(new Date(today.getFullYear(), 0, 1)), to }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/domain/export/presets.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/domain/export/presets.ts lib/domain/export/presets.test.ts
git commit -m "feat(export): pure date-range preset helper"
```

---

### Task 3: `buildJsonBundle` records applied filters in `meta`

**Files:**
- Modify: `lib/domain/export/bundle.ts:58-76` (the `buildJsonBundle` function)
- Modify: `lib/domain/export/bundle.test.ts` (add cases; existing cases must not change)

**Interfaces:**
- Consumes: existing `ExportInput`.
- Produces (used by Task 4): `buildJsonBundle(input: ExportInput, meta: { exportedAt: string; version: string; filters?: Record<string, string> }): object`. When `filters` is a non-empty record, the returned `meta` includes it verbatim; otherwise `meta` has no `filters` key.

- [ ] **Step 1: Write the failing tests**

Append to the existing `describe` (or add a new one) in `lib/domain/export/bundle.test.ts`:

```ts
const EMPTY_INPUT = { accounts: [], categories: [], transactions: [] }

describe('buildJsonBundle meta.filters', () => {
  it('records applied filters verbatim when given', () => {
    const bundle = buildJsonBundle(EMPTY_INPUT, {
      exportedAt: '2026-07-03T00:00:00.000Z',
      version: '1',
      filters: { from: '2026-01-01', account: 'acc-1' },
    }) as { meta: { filters?: Record<string, string> } }
    expect(bundle.meta.filters).toEqual({ from: '2026-01-01', account: 'acc-1' })
  })

  it('omits the filters key when absent or empty', () => {
    const plain = buildJsonBundle(EMPTY_INPUT, {
      exportedAt: '2026-07-03T00:00:00.000Z',
      version: '1',
    }) as { meta: object }
    expect(plain.meta).not.toHaveProperty('filters')

    const empty = buildJsonBundle(EMPTY_INPUT, {
      exportedAt: '2026-07-03T00:00:00.000Z',
      version: '1',
      filters: {},
    }) as { meta: object }
    expect(empty.meta).not.toHaveProperty('filters')
  })
})
```

(Adjust the `EMPTY_INPUT` literal with a `satisfies ExportInput` if the file already imports the type; empty arrays are valid rows-arrays.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/export/bundle.test.ts`
Expected: the two new tests FAIL (`filters` is currently spread into meta or absent-typed); existing tests PASS.

- [ ] **Step 3: Implement**

In `lib/domain/export/bundle.ts` replace `buildJsonBundle`:

```ts
/**
 * The full dataset as a JSON-serializable bundle with a meta header. When the
 * export was filtered, `meta.filters` records the active query params so a
 * partial export is self-describing; unfiltered bundles carry no `filters` key.
 */
export function buildJsonBundle(
  input: ExportInput,
  meta: {
    exportedAt: string
    version: string
    filters?: Record<string, string>
  }
): object {
  const { filters, ...rest } = meta
  return {
    meta: {
      ...rest,
      ...(filters && Object.keys(filters).length > 0 ? { filters } : {}),
      counts: {
        accounts: input.accounts.length,
        categories: input.categories.length,
        transactions: input.transactions.length,
      },
    },
    accounts: input.accounts,
    categories: input.categories,
    transactions: input.transactions,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/domain/export/bundle.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/export/bundle.ts lib/domain/export/bundle.test.ts
git commit -m "feat(export): record applied filters in the JSON bundle meta"
```

---

### Task 4: Filtered export read layer and route handlers

Wire filters through `getExportData` and both routes. No new unit tests here (the pieces are covered by Tasks 1 and 3; the routes are thin composition verified by typecheck + the end-to-end check in Task 6).

**Files:**
- Modify: `app/protected/export/data.ts`
- Modify: `app/protected/export/transactions.csv/route.ts`
- Modify: `app/protected/export/data.json/route.ts`

**Interfaces:**
- Consumes: `applyFilters` (Task 1); `parseFilters`, `filtersToSearchParams`, `hasActiveFilters`, `EMPTY_FILTERS`, `TransactionFilters` from `@/lib/domain/transactions/filters` (existing); `buildJsonBundle` with `filters` (Task 3).
- Produces: `getExportData(filters?: TransactionFilters): Promise<ExportInput>` (defaults to `EMPTY_FILTERS`); both `GET` handlers accept `request: Request` and honor `from`/`to`/`account`/`category` query params.

- [ ] **Step 1: Update `app/protected/export/data.ts`**

```ts
import 'server-only'
import { requireUser } from '@/lib/auth/require-user'
import { applyFilters } from '@/lib/domain/transactions/apply-filters'
import {
  EMPTY_FILTERS,
  type TransactionFilters,
} from '@/lib/domain/transactions/filters'
import type { ExportInput } from '@/lib/domain/export/bundle'
import { createClient } from '@/lib/supabase/server'
import { accountRowSchema } from '@/lib/validation/account'
import { categoryRowSchema } from '@/lib/validation/category'
import { transactionRowSchema } from '@/lib/validation/transaction'

/**
 * Export read layer (P4-05). RLS-enforced read of the user's data — every
 * query goes through the Supabase server client, so a user only ever exports
 * their own rows. Filters (export filters spec, 2026-07-03) narrow the
 * transactions query only; accounts and categories always export in full so
 * JSON references stay resolvable. Transactions are ordered oldest-first so
 * the exported ledger reads chronologically.
 */
export async function getExportData(
  filters: TransactionFilters = EMPTY_FILTERS
): Promise<ExportInput> {
  await requireUser()
  const supabase = await createClient()

  const [accountsRes, categoriesRes, txnsRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: true }),
    supabase.from('categories').select('*').order('name', { ascending: true }),
    applyFilters(supabase.from('transactions').select('*'), filters).order(
      'occurred_at',
      { ascending: true }
    ),
  ])

  if (accountsRes.error) throw new Error(accountsRes.error.message)
  if (categoriesRes.error) throw new Error(categoriesRes.error.message)
  if (txnsRes.error) throw new Error(txnsRes.error.message)

  return {
    accounts: accountRowSchema.array().parse(accountsRes.data),
    categories: categoryRowSchema.array().parse(categoriesRes.data),
    transactions: transactionRowSchema.array().parse(txnsRes.data),
  }
}
```

- [ ] **Step 2: Update the CSV route**

`app/protected/export/transactions.csv/route.ts`:

```ts
import { transactionsCsv } from '@/lib/domain/export/bundle'
import {
  hasActiveFilters,
  parseFilters,
} from '@/lib/domain/transactions/filters'
import { getExportData } from '../data'

/**
 * CSV export of the transactions ledger (P4-05). RLS-scoped via `getExportData`.
 * Honors the shared filter query params (`from`/`to`/`account`/`category`);
 * malformed values are dropped by `parseFilters`, never rejected. The file
 * re-imports cleanly through the P2-03 pipeline (the gate invariant).
 */
export async function GET(request: Request): Promise<Response> {
  const filters = parseFilters(
    Object.fromEntries(new URL(request.url).searchParams)
  )
  const { transactions } = await getExportData(filters)
  const csv = transactionsCsv(transactions)
  const date = new Date().toISOString().slice(0, 10)
  const suffix = hasActiveFilters(filters) ? '-filtered' : ''

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="finova-transactions-${date}${suffix}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
```

- [ ] **Step 3: Update the JSON route**

`app/protected/export/data.json/route.ts`:

```ts
import { buildJsonBundle } from '@/lib/domain/export/bundle'
import {
  filtersToSearchParams,
  hasActiveFilters,
  parseFilters,
} from '@/lib/domain/transactions/filters'
import { getExportData } from '../data'

const BUNDLE_VERSION = '1'

/**
 * Full-dataset JSON export (P4-05). RLS-scoped via `getExportData`: accounts +
 * categories always complete; transactions narrowed by the shared filter query
 * params, with the active filters recorded in `meta.filters` so a partial
 * export is self-describing.
 */
export async function GET(request: Request): Promise<Response> {
  const filters = parseFilters(
    Object.fromEntries(new URL(request.url).searchParams)
  )
  const data = await getExportData(filters)
  const exportedAt = new Date().toISOString()
  const filtered = hasActiveFilters(filters)
  const bundle = buildJsonBundle(data, {
    exportedAt,
    version: BUNDLE_VERSION,
    ...(filtered
      ? { filters: Object.fromEntries(filtersToSearchParams(filters)) }
      : {}),
  })
  const suffix = filtered ? '-filtered' : ''

  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="finova-export-${exportedAt.slice(0, 10)}${suffix}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
```

- [ ] **Step 4: Verify**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: PASS. (Existing callers of `getExportData` pass no argument and get `EMPTY_FILTERS` — behavior unchanged.)

- [ ] **Step 5: Commit**

```bash
git add app/protected/export/data.ts app/protected/export/transactions.csv/route.ts app/protected/export/data.json/route.ts
git commit -m "feat(export): honor filter query params in export routes"
```

---

### Task 5: `ExportFilters` UI + messages

Client filter bar that owns the filter state and renders the two download cards with computed hrefs. `ExportPanel` stays a server component and now also fetches the picker lists.

**Files:**
- Create: `app/protected/export/ExportFilters.tsx`
- Create: `app/protected/export/ExportFilters.test.tsx`
- Modify: `app/protected/export/ExportPanel.tsx`
- Modify: `messages/en.json` (inside the existing `"export"` object)
- Modify: `messages/es.json` (same keys, Spanish copy)

**Interfaces:**
- Consumes: `EXPORT_PRESETS`, `presetRange` (Task 2); `UNCATEGORIZED` from `@/lib/domain/transactions/filters`; `categoryLabel` from `@/lib/domain/categories/label`; `listAccountsForPicker`, `listCategoriesForPicker` from `@/app/protected/transactions/data` (existing, RLS-scoped); `AccountRow`, `CategoryRow` types; `Button`, `GlassCard`, `Input`, `Label` UI components.
- Produces: `ExportFilters({ accounts, categories }: { accounts: AccountRow[]; categories: CategoryRow[] })` client component rendering the filter bar **and** both download cards.

- [ ] **Step 1: Add messages**

In `messages/en.json`, inside the existing `"export"` object, add a `"filters"` sibling of `"csv"`/`"json"`:

```json
"filters": {
  "legend": "What to export",
  "presets": {
    "all": "All time",
    "month": "This month",
    "quarter": "Last 3 months",
    "year": "This year"
  },
  "from": "From",
  "to": "To",
  "account": "Account",
  "allAccounts": "All accounts",
  "category": "Category",
  "allCategories": "All categories",
  "uncategorized": "Uncategorized",
  "filteredNote": "Filters apply to both downloads. The JSON file still includes all your accounts and categories, but only the matching transactions."
}
```

In `messages/es.json`, same structure:

```json
"filters": {
  "legend": "Qué exportar",
  "presets": {
    "all": "Todo el historial",
    "month": "Este mes",
    "quarter": "Últimos 3 meses",
    "year": "Este año"
  },
  "from": "Desde",
  "to": "Hasta",
  "account": "Cuenta",
  "allAccounts": "Todas las cuentas",
  "category": "Categoría",
  "allCategories": "Todas las categorías",
  "uncategorized": "Sin categoría",
  "filteredNote": "Los filtros se aplican a ambas descargas. El archivo JSON sigue incluyendo todas tus cuentas y categorías, pero solo las transacciones que coinciden."
}
```

- [ ] **Step 2: Write the failing component test**

Create `app/protected/export/ExportFilters.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it } from 'vitest'
import en from '@/messages/en.json'
import type { AccountRow } from '@/lib/validation/account'
import type { CategoryRow } from '@/lib/validation/category'
import { ExportFilters } from './ExportFilters'

const account: AccountRow = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: 'u1',
  name: 'Sabadell',
  type: 'checking',
  currency: 'EUR',
  opening_balance: 0,
  archived: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const category: CategoryRow = {
  id: '22222222-2222-4222-8222-222222222222',
  user_id: 'u1',
  parent_id: null,
  name: 'Groceries',
  name_key: null,
  kind: 'expense',
  is_default: false,
  icon_name: null,
  color: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function renderFilters() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ExportFilters accounts={[account]} categories={[category]} />
    </NextIntlClientProvider>
  )
}

const csvHref = () =>
  screen.getByRole('link', { name: /download csv/i }).getAttribute('href')
const jsonHref = () =>
  screen.getByRole('link', { name: /download json/i }).getAttribute('href')

describe('ExportFilters', () => {
  it('defaults to unfiltered downloads', () => {
    renderFilters()
    expect(csvHref()).toBe('/protected/export/transactions.csv')
    expect(jsonHref()).toBe('/protected/export/data.json')
    expect(screen.queryByText(/filters apply to both/i)).not.toBeInTheDocument()
  })

  it('adds account and category params to both hrefs', () => {
    renderFilters()
    fireEvent.change(screen.getByLabelText('Account'), {
      target: { value: account.id },
    })
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: category.id },
    })
    expect(csvHref()).toBe(
      `/protected/export/transactions.csv?account=${account.id}&category=${category.id}`
    )
    expect(jsonHref()).toBe(
      `/protected/export/data.json?account=${account.id}&category=${category.id}`
    )
    expect(screen.getByText(/filters apply to both/i)).toBeInTheDocument()
  })

  it('fills the date inputs from a preset', () => {
    renderFilters()
    fireEvent.click(screen.getByRole('button', { name: 'This year' }))
    const from = screen.getByLabelText('From') as HTMLInputElement
    expect(from.value).toMatch(/^\d{4}-01-01$/)
    expect(csvHref()).toContain('from=')
    expect(csvHref()).toContain('to=')
  })

  it('custom dates override the preset selection', () => {
    renderFilters()
    fireEvent.click(screen.getByRole('button', { name: 'This year' }))
    fireEvent.change(screen.getByLabelText('From'), {
      target: { value: '2026-03-15' },
    })
    expect(csvHref()).toContain('from=2026-03-15')
    expect(
      screen.getByRole('button', { name: 'This year' })
    ).toHaveAttribute('aria-pressed', 'false')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run app/protected/export/ExportFilters.test.tsx`
Expected: FAIL — cannot resolve `./ExportFilters`.

- [ ] **Step 4: Implement `ExportFilters`**

Create `app/protected/export/ExportFilters.tsx`:

```tsx
'use client'

import { Download, FileJson, FileSpreadsheet } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { GlassCard } from '@/components/ui/GlassCard'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { categoryLabel } from '@/lib/domain/categories/label'
import {
  EXPORT_PRESETS,
  type ExportPreset,
  presetRange,
} from '@/lib/domain/export/presets'
import { UNCATEGORIZED } from '@/lib/domain/transactions/filters'
import type { AccountRow } from '@/lib/validation/account'
import type { CategoryRow } from '@/lib/validation/category'

const SELECT_CLASS =
  'h-11 w-full rounded-2xl border border-glass-line bg-glass px-3 text-ink text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

const CARDS = [
  { key: 'csv', href: '/protected/export/transactions.csv', Icon: FileSpreadsheet },
  { key: 'json', href: '/protected/export/data.json', Icon: FileJson },
] as const

/**
 * Shared export filter bar + the two download cards (export filters spec,
 * 2026-07-03). Filter state is transient client state — the download URLs are
 * where it matters, so both anchors carry the same query params the
 * transactions page uses and the route handlers already parse.
 */
export function ExportFilters({
  accounts,
  categories,
}: {
  accounts: AccountRow[]
  categories: CategoryRow[]
}) {
  const t = useTranslations('export')
  const tCat = useTranslations('categories.defaults')
  const [preset, setPreset] = useState<ExportPreset | null>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [account, setAccount] = useState('')
  const [category, setCategory] = useState('')

  const applyPreset = (p: ExportPreset) => {
    setPreset(p)
    const range = presetRange(p, new Date())
    setFrom(range.from ?? '')
    setTo(range.to ?? '')
  }

  // Editing a date by hand means "custom": no pill stays highlighted.
  const setCustomDate = (setter: (v: string) => void) => (value: string) => {
    setPreset(null)
    setter(value)
  }

  const sp = new URLSearchParams()
  if (from) sp.set('from', from)
  if (to) sp.set('to', to)
  if (account) sp.set('account', account)
  if (category) sp.set('category', category)
  const qs = sp.toString()
  const withFilters = (href: string) => (qs ? `${href}?${qs}` : href)

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-3 rounded-2xl border border-glass-line bg-glass p-4 shadow-soft">
        <legend className="sr-only">{t('filters.legend')}</legend>

        <div className="flex flex-wrap gap-2">
          {EXPORT_PRESETS.map((p) => (
            <Button
              key={p}
              type="button"
              size="sm"
              variant={preset === p ? 'default' : 'outline'}
              aria-pressed={preset === p}
              onClick={() => applyPreset(p)}
            >
              {t(`filters.presets.${p}`)}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="export-from">{t('filters.from')}</Label>
            <Input
              id="export-from"
              type="date"
              value={from}
              onChange={(e) => setCustomDate(setFrom)(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="export-to">{t('filters.to')}</Label>
            <Input
              id="export-to"
              type="date"
              value={to}
              onChange={(e) => setCustomDate(setTo)(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="export-account">{t('filters.account')}</Label>
            <select
              id="export-account"
              className={SELECT_CLASS}
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            >
              <option value="">{t('filters.allAccounts')}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="export-category">{t('filters.category')}</Label>
            <select
              id="export-category"
              className={SELECT_CLASS}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">{t('filters.allCategories')}</option>
              <option value={UNCATEGORIZED}>{t('filters.uncategorized')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryLabel(c, tCat)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {qs ? (
          <p className="text-ink-soft text-xs">{t('filters.filteredNote')}</p>
        ) : null}
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CARDS.map(({ key, href, Icon }) => (
          <GlassCard key={key} className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="flex flex-col">
                <span className="font-medium text-ink">
                  {t(`${key}.title`)}
                </span>
                <span className="text-ink-soft text-xs">
                  {t(`${key}.description`)}
                </span>
              </div>
            </div>
            <Button asChild variant="outline" className="w-fit">
              {/* Plain anchor + download: lets the browser stream the file. */}
              <a href={withFilters(href)} download>
                <Download aria-hidden="true" />
                {t(`${key}.download`)}
              </a>
            </Button>
          </GlassCard>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Rewire `ExportPanel`**

Replace `app/protected/export/ExportPanel.tsx` with:

```tsx
import { getTranslations } from 'next-intl/server'
import {
  listAccountsForPicker,
  listCategoriesForPicker,
} from '@/app/protected/transactions/data'
import { ExportFilters } from './ExportFilters'

/**
 * Export surface (P4-05), embedded as a tab of the merged Datos screen (nav IA
 * priority 2). A shared filter bar (date range / category / account) feeds two
 * downloads: the transactions CSV ledger (re-imports cleanly) and the full
 * JSON bundle. The actual files stream from the sibling route handlers,
 * RLS-scoped.
 */
export async function ExportPanel() {
  const t = await getTranslations('export')
  const [accounts, categories] = await Promise.all([
    listAccountsForPicker(),
    listCategoriesForPicker(),
  ])

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <p className="max-w-2xl text-ink-soft text-sm">{t('description')}</p>
      <ExportFilters accounts={accounts} categories={categories} />
    </div>
  )
}
```

(Check the `@/app/...` import alias resolves — the repo aliases `@` to the root, so `@/app/protected/transactions/data` is valid; if Biome/tsc complains, use the relative `../transactions/data`.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run app/protected/export/ExportFilters.test.tsx && npm run test && npm run typecheck && npm run lint`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add app/protected/export/ExportFilters.tsx app/protected/export/ExportFilters.test.tsx app/protected/export/ExportPanel.tsx messages/en.json messages/es.json
git commit -m "feat(export): shared filter bar for CSV/JSON downloads"
```

---

### Task 6: End-to-end verification

**Files:** none (verification only).

- [x] **Step 1: Full suite** — PASS 2026-07-06 (706 tests / 63 files, typecheck clean, biome clean).

Run: `npm run test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 2: Exercise the running app** — BLOCKED for the agent (sandbox denies socket listen + `.env.local` read + Supabase egress); needs a human run.

Start `npm run dev`, sign in, open **Datos → Export** and verify:
- Preset pills fill the date inputs; editing a date un-highlights the pill.
- Both download links carry the query string as filters change.
- Downloading the CSV with a category filter yields only matching rows and a `-filtered` filename.
- Downloading the JSON with filters active yields full `accounts`/`categories`, filtered `transactions`, and a `meta.filters` object; without filters, no `meta.filters` and no suffix.
- A hand-mangled URL (e.g. `?from=garbage&account=nope`) downloads the full unfiltered export.
