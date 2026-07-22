# Bulk Delete Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user select transactions via checkboxes — including "select all matching the current filter" across every page, not just the loaded one — and delete the whole selection in one confirmed action.

**Architecture:** A pure `SelectionState` (three modes: none / explicit ids / all-matching-filter-minus-exclusions) lives in `packages/domain`. A client-side React Context (`SelectionProvider`) holds that state and wraps the existing server-rendered transaction list; each row's existing client component reads/writes it via a checkbox. A new server action `bulkDeleteTransactions` performs the delete for either mode in one SQL statement, reusing the existing `applyFilters` helper for the filtered mode.

**Tech Stack:** Next.js App Router (server + client components), Supabase/PostgREST, Zod, shadcn/ui (`Checkbox`, `Dialog`, `Button`), next-intl, Vitest.

## Global Constraints

- Every server action starts with `requireUser()` and uses the RLS-enforced Supabase server client — never trust the caller's claimed ownership of a row beyond what RLS already scopes.
- Do **not** modify `packages/domain/src/transactions/pagination.ts`, `TransactionPagination.tsx`/`TransactionLoadMore.tsx`, or `listTransactions`'s pagination parameter. There is a separate, uncommitted, in-progress refactor of the transactions pagination model (page-based → "load more") already sitting in the working tree — this plan targets today's **committed** page-based pagination (`parsePage`/`totalPages`/`pageRange`, `listTransactions(filters, page)`) and must not touch those files. If you see local modifications there when you start, leave them exactly as they are.
- No soft-delete/undo — a single-click confirm dialog showing the exact count is enough friction, matching the rest of the app's destructive actions today.
- Follow existing i18n conventions: add both `en` and `es` strings for every new user-facing string, using simple `{placeholder}` interpolation (no ICU plural rules — the codebase doesn't use them anywhere else).
- Pure logic (no I/O, no React) goes in `packages/domain/src/transactions/`, gets a Vitest unit test. Nothing under `app/` in this codebase has automated tests today (server actions, page wiring) — verify those manually in the browser instead of writing new test infra for them.

---

### Task 1: Selection-state domain module

**Files:**
- Create: `packages/domain/src/transactions/selection.ts`
- Test: `packages/domain/src/transactions/selection.test.ts`

**Interfaces:**
- Produces: `SelectionState` (union type), `EMPTY_SELECTION`, `selectPage(pageIds)`, `selectAllFiltered()`, `clearSelection()`, `toggleId(state, id)`, `isSelected(state, id)`, `selectionCount(state, totalMatchingFilter)`, `HeaderCheckboxState` (`'checked' | 'unchecked' | 'indeterminate'`), `headerCheckboxState(state, pageIds)`. All of these are consumed by Task 3 (`SelectionContext.tsx`).

- [ ] **Step 1: Write the failing tests**

Create `packages/domain/src/transactions/selection.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  clearSelection,
  EMPTY_SELECTION,
  headerCheckboxState,
  isSelected,
  selectAllFiltered,
  selectionCount,
  selectPage,
  toggleId,
} from './selection'

describe('selectPage', () => {
  it('selects exactly the given ids in ids mode', () => {
    const state = selectPage(['a', 'b'])
    expect(state).toEqual({ mode: 'ids', ids: new Set(['a', 'b']) })
  })
})

describe('selectAllFiltered', () => {
  it('switches to all-filtered mode with no exclusions', () => {
    expect(selectAllFiltered()).toEqual({
      mode: 'all-filtered',
      excludedIds: new Set(),
    })
  })
})

describe('clearSelection', () => {
  it('returns the empty selection', () => {
    expect(clearSelection()).toBe(EMPTY_SELECTION)
  })
})

describe('toggleId', () => {
  it('starts a new ids-mode selection from none', () => {
    expect(toggleId(EMPTY_SELECTION, 'a')).toEqual({
      mode: 'ids',
      ids: new Set(['a']),
    })
  })

  it('adds an id within ids mode', () => {
    const state = selectPage(['a'])
    expect(toggleId(state, 'b')).toEqual({
      mode: 'ids',
      ids: new Set(['a', 'b']),
    })
  })

  it('removes an id within ids mode', () => {
    const state = selectPage(['a', 'b'])
    expect(toggleId(state, 'a')).toEqual({ mode: 'ids', ids: new Set(['b']) })
  })

  it('collapses to none when the last id is removed', () => {
    const state = selectPage(['a'])
    expect(toggleId(state, 'a')).toEqual(EMPTY_SELECTION)
  })

  it('excludes an id within all-filtered mode', () => {
    const state = selectAllFiltered()
    expect(toggleId(state, 'a')).toEqual({
      mode: 'all-filtered',
      excludedIds: new Set(['a']),
    })
  })

  it('re-includes a previously excluded id within all-filtered mode', () => {
    const state = toggleId(selectAllFiltered(), 'a')
    expect(toggleId(state, 'a')).toEqual({
      mode: 'all-filtered',
      excludedIds: new Set(),
    })
  })
})

describe('isSelected', () => {
  it('is false for every id when mode is none', () => {
    expect(isSelected(EMPTY_SELECTION, 'a')).toBe(false)
  })

  it('checks membership in ids mode', () => {
    const state = selectPage(['a'])
    expect(isSelected(state, 'a')).toBe(true)
    expect(isSelected(state, 'b')).toBe(false)
  })

  it('is true unless excluded in all-filtered mode', () => {
    const state = toggleId(selectAllFiltered(), 'a')
    expect(isSelected(state, 'a')).toBe(false)
    expect(isSelected(state, 'b')).toBe(true)
  })
})

describe('selectionCount', () => {
  it('is 0 when mode is none', () => {
    expect(selectionCount(EMPTY_SELECTION, 342)).toBe(0)
  })

  it('is the ids set size in ids mode', () => {
    expect(selectionCount(selectPage(['a', 'b', 'c']), 342)).toBe(3)
  })

  it('is total minus exclusions in all-filtered mode', () => {
    const state = toggleId(toggleId(selectAllFiltered(), 'a'), 'b')
    expect(selectionCount(state, 342)).toBe(340)
  })
})

describe('headerCheckboxState', () => {
  it('is unchecked when the page is empty', () => {
    expect(headerCheckboxState(EMPTY_SELECTION, [])).toBe('unchecked')
  })

  it('is unchecked when nothing on the page is selected', () => {
    expect(headerCheckboxState(EMPTY_SELECTION, ['a', 'b'])).toBe('unchecked')
  })

  it('is checked when every id on the page is selected', () => {
    expect(headerCheckboxState(selectPage(['a', 'b']), ['a', 'b'])).toBe(
      'checked'
    )
  })

  it('is indeterminate when only some of the page is selected', () => {
    expect(headerCheckboxState(selectPage(['a']), ['a', 'b'])).toBe(
      'indeterminate'
    )
  })

  it('is checked in all-filtered mode with no exclusions on the page', () => {
    expect(headerCheckboxState(selectAllFiltered(), ['a', 'b'])).toBe(
      'checked'
    )
  })

  it('is indeterminate in all-filtered mode with a partial page exclusion', () => {
    const state = toggleId(selectAllFiltered(), 'a')
    expect(headerCheckboxState(state, ['a', 'b'])).toBe('indeterminate')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run packages/domain/src/transactions/selection.test.ts`
Expected: FAIL — `Cannot find module './selection'` (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `packages/domain/src/transactions/selection.ts`:

```ts
/**
 * Pure selection-state helpers for bulk-deleting transactions. No I/O, no
 * React — a `SelectionState` is either explicit row ids or "every row
 * matching the current filter minus a few explicitly excluded", so a giant
 * filtered set never needs to be materialized as an id list client-side.
 */

export type SelectionState =
  | { mode: 'none' }
  | { mode: 'ids'; ids: ReadonlySet<string> }
  | { mode: 'all-filtered'; excludedIds: ReadonlySet<string> }

export const EMPTY_SELECTION: SelectionState = { mode: 'none' }

/** Select every id on the current page (explicit ids mode). */
export function selectPage(pageIds: readonly string[]): SelectionState {
  return { mode: 'ids', ids: new Set(pageIds) }
}

/** Select every row matching the active filter, across all pages. */
export function selectAllFiltered(): SelectionState {
  return { mode: 'all-filtered', excludedIds: new Set() }
}

export function clearSelection(): SelectionState {
  return EMPTY_SELECTION
}

/** Toggle one row's selection, regardless of the current mode. */
export function toggleId(state: SelectionState, id: string): SelectionState {
  if (state.mode === 'none') {
    return { mode: 'ids', ids: new Set([id]) }
  }
  if (state.mode === 'ids') {
    const ids = new Set(state.ids)
    if (ids.has(id)) {
      ids.delete(id)
    } else {
      ids.add(id)
    }
    return ids.size === 0 ? EMPTY_SELECTION : { mode: 'ids', ids }
  }
  const excludedIds = new Set(state.excludedIds)
  if (excludedIds.has(id)) {
    excludedIds.delete(id)
  } else {
    excludedIds.add(id)
  }
  return { mode: 'all-filtered', excludedIds }
}

export function isSelected(state: SelectionState, id: string): boolean {
  switch (state.mode) {
    case 'none':
      return false
    case 'ids':
      return state.ids.has(id)
    case 'all-filtered':
      return !state.excludedIds.has(id)
  }
}

/** Total rows currently selected, given how many rows match the active filter. */
export function selectionCount(
  state: SelectionState,
  totalMatchingFilter: number
): number {
  switch (state.mode) {
    case 'none':
      return 0
    case 'ids':
      return state.ids.size
    case 'all-filtered':
      return totalMatchingFilter - state.excludedIds.size
  }
}

export type HeaderCheckboxState = 'checked' | 'unchecked' | 'indeterminate'

/** Tri-state for the "select all on this page" header checkbox. */
export function headerCheckboxState(
  state: SelectionState,
  pageIds: readonly string[]
): HeaderCheckboxState {
  if (pageIds.length === 0) {
    return 'unchecked'
  }
  const selectedCount = pageIds.filter((id) => isSelected(state, id)).length
  if (selectedCount === 0) {
    return 'unchecked'
  }
  if (selectedCount === pageIds.length) {
    return 'checked'
  }
  return 'indeterminate'
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/domain/src/transactions/selection.test.ts`
Expected: PASS (all cases above green).

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/transactions/selection.ts packages/domain/src/transactions/selection.test.ts
git commit -m "feat(transactions): add pure selection-state helpers for bulk delete"
```

---

### Task 2: `bulkDeleteTransactions` server action

**Files:**
- Modify: `app/protected/transactions/actions.ts`

**Interfaces:**
- Consumes: `applyFilters<Q>(query, filters)` from `@finova/domain/transactions/apply-filters` (already imported in `data.ts`); `TRANSACTION_TYPES`, `TransactionFilters`, `UNCATEGORIZED` from `@finova/domain/transactions/filters`; existing `requireUser`, `createClient`, `UNEXPECTED`, `TX_PATH` already in this file.
- Produces: `bulkDeleteTransactions(input: unknown): Promise<BulkDeleteResult>`, `BulkDeleteResult = { ok: true; deleted: number } | { ok: false; error: string }`. Consumed by Task 6 (`BulkDeleteBar.tsx`).

- [ ] **Step 1: Add the action**

In `app/protected/transactions/actions.ts`, add this import alongside the existing ones near the top of the file (after the `selectCategory` import):

```ts
import { applyFilters } from '@finova/domain/transactions/apply-filters'
import {
  TRANSACTION_TYPES,
  type TransactionFilters,
} from '@finova/domain/transactions/filters'
```

Then append at the end of the file, after `recategorizeUncategorized`:

```ts
const uuidArray = z.array(z.string().uuid())

const bulkDeleteFiltersSchema = z.object({
  accountId: z.string().uuid().nullable(),
  categoryId: z.string().min(1).nullable(),
  type: z.enum(TRANSACTION_TYPES).nullable(),
  from: z.string().nullable(),
  to: z.string().nullable(),
  q: z.string().nullable(),
}) satisfies z.ZodType<TransactionFilters>

const bulkDeleteInputSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('ids'), ids: uuidArray.min(1) }),
  z.object({
    mode: z.literal('filtered'),
    filters: bulkDeleteFiltersSchema,
    excludeIds: uuidArray,
  }),
])

export type BulkDeleteResult =
  | { ok: true; deleted: number }
  | { ok: false; error: string }

/**
 * Delete many transactions in one statement: either an explicit id list, or
 * every row matching `filters` minus `excludeIds` (the "select all matching
 * filter, then un-check a few" case). RLS scopes both to the caller's own
 * rows regardless of what `filters`/`ids` claim, so a tampered client input
 * can only narrow the set further, never widen it to another user's rows.
 */
export async function bulkDeleteTransactions(
  input: unknown
): Promise<BulkDeleteResult> {
  await requireUser()
  const parsed = bulkDeleteInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: UNEXPECTED }
  }

  const supabase = await createClient()
  try {
    if (parsed.data.mode === 'ids') {
      const { error, count } = await supabase
        .from('transactions')
        .delete({ count: 'exact' })
        .in('id', parsed.data.ids)
      if (error) {
        return { ok: false, error: UNEXPECTED }
      }
      revalidatePath(TX_PATH)
      return { ok: true, deleted: count ?? 0 }
    }

    let query = applyFilters(
      supabase.from('transactions').delete({ count: 'exact' }),
      parsed.data.filters
    )
    if (parsed.data.excludeIds.length > 0) {
      query = query.not('id', 'in', `(${parsed.data.excludeIds.join(',')})`)
    }
    const { error, count } = await query
    if (error) {
      return { ok: false, error: UNEXPECTED }
    }
    revalidatePath(TX_PATH)
    return { ok: true, deleted: count ?? 0 }
  } catch {
    return { ok: false, error: UNEXPECTED }
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (No automated test for this action — no server action in `app/` has one today; verify it manually once the UI is wired up in Task 7.)

- [ ] **Step 3: Commit**

```bash
git add app/protected/transactions/actions.ts
git commit -m "feat(transactions): add bulkDeleteTransactions server action"
```

---

### Task 3: `SelectionProvider` client context

**Files:**
- Create: `app/protected/transactions/SelectionContext.tsx`

**Interfaces:**
- Consumes: everything from Task 1's `selection.ts`; `TransactionFilters` type from `@finova/domain/transactions/filters`.
- Produces: `SelectionProvider({ pageIds, totalFiltered, filters, children })` and `useSelection()` returning `{ state, pageIds, totalFiltered, filters, isSelected(id), toggle(id), toggleHeader(), selectAllMatchingFilter(), clear(), count, headerState }`. Consumed by Task 4 (`SelectionHeader.tsx`), Task 5 (`TransactionRow.tsx`), Task 6 (`BulkDeleteBar.tsx`), Task 7 (`transaction-list.tsx`).

- [ ] **Step 1: Write the component**

Create `app/protected/transactions/SelectionContext.tsx`:

```tsx
'use client'

import type { TransactionFilters } from '@finova/domain/transactions/filters'
import {
  clearSelection,
  EMPTY_SELECTION,
  type HeaderCheckboxState,
  headerCheckboxState,
  isSelected as isSelectedFn,
  selectAllFiltered,
  selectionCount,
  selectPage,
  type SelectionState,
  toggleId,
} from '@finova/domain/transactions/selection'
import { createContext, type ReactNode, useContext, useMemo, useState } from 'react'

interface SelectionContextValue {
  state: SelectionState
  pageIds: string[]
  totalFiltered: number
  filters: TransactionFilters
  isSelected: (id: string) => boolean
  toggle: (id: string) => void
  toggleHeader: () => void
  selectAllMatchingFilter: () => void
  clear: () => void
  count: number
  headerState: HeaderCheckboxState
}

const SelectionContext = createContext<SelectionContextValue | null>(null)

export function SelectionProvider({
  pageIds,
  totalFiltered,
  filters,
  children,
}: {
  pageIds: string[]
  totalFiltered: number
  filters: TransactionFilters
  children: ReactNode
}) {
  const [state, setState] = useState<SelectionState>(EMPTY_SELECTION)

  const value = useMemo<SelectionContextValue>(() => {
    const header = headerCheckboxState(state, pageIds)
    return {
      state,
      pageIds,
      totalFiltered,
      filters,
      isSelected: (id: string) => isSelectedFn(state, id),
      toggle: (id: string) => setState((s) => toggleId(s, id)),
      toggleHeader: () =>
        setState(() =>
          header === 'unchecked' ? selectPage(pageIds) : clearSelection()
        ),
      selectAllMatchingFilter: () => setState(selectAllFiltered()),
      clear: () => setState(clearSelection()),
      count: selectionCount(state, totalFiltered),
      headerState: header,
    }
  }, [state, pageIds, totalFiltered, filters])

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  )
}

export function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext)
  if (!ctx) {
    throw new Error('useSelection must be used within a SelectionProvider')
  }
  return ctx
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (nothing consumes `useSelection`/`SelectionProvider` yet, so this only needs to compile standalone).

- [ ] **Step 3: Commit**

```bash
git add app/protected/transactions/SelectionContext.tsx
git commit -m "feat(transactions): add SelectionProvider context for bulk delete"
```

---

### Task 4: Header "select all on page" checkbox

**Files:**
- Create: `app/protected/transactions/SelectionHeader.tsx`
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Consumes: `useSelection()` from Task 3.
- Produces: `<SelectionHeader />`. Consumed by Task 7 (`transaction-list.tsx`).

- [ ] **Step 1: Add i18n strings**

In `messages/en.json`, inside the `"transactions"` object, add a new `"selection"` key (place it after `"recategorize"`, before `"fields"`):

```json
"selection": {
  "selectPage": "Select all on this page",
  "selectRow": "Select transaction",
  "count": "{count} selected",
  "selectAllFiltered": "Select all {count} matching filter",
  "clear": "Clear selection",
  "deleteButton": "Delete selected",
  "confirmTitle": "Delete {count} transactions?",
  "confirmBody": "This can't be undone."
},
```

In `messages/es.json`, inside the `"transactions"` object, in the same position:

```json
"selection": {
  "selectPage": "Seleccionar todo en esta página",
  "selectRow": "Seleccionar transacción",
  "count": "{count} seleccionadas",
  "selectAllFiltered": "Seleccionar las {count} que coinciden con el filtro",
  "clear": "Borrar selección",
  "deleteButton": "Eliminar seleccionadas",
  "confirmTitle": "¿Eliminar {count} transacciones?",
  "confirmBody": "No se puede deshacer."
},
```

- [ ] **Step 2: Write the component**

Create `app/protected/transactions/SelectionHeader.tsx`:

```tsx
'use client'

import { useTranslations } from 'next-intl'
import { Checkbox } from '@/components/ui/Checkbox'
import { useSelection } from './SelectionContext'

export function SelectionHeader() {
  const t = useTranslations('transactions')
  const { headerState, toggleHeader } = useSelection()

  return (
    <div className="flex items-center gap-2 px-1">
      <Checkbox
        checked={headerState === 'indeterminate' ? 'indeterminate' : headerState === 'checked'}
        onCheckedChange={toggleHeader}
        aria-label={t('selection.selectPage')}
      />
      <span className="text-ink-soft text-xs">{t('selection.selectPage')}</span>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/protected/transactions/SelectionHeader.tsx messages/en.json messages/es.json
git commit -m "feat(transactions): add header select-all-on-page checkbox"
```

---

### Task 5: Row checkbox in `TransactionRow`

**Files:**
- Modify: `app/protected/transactions/TransactionRow.tsx`

**Interfaces:**
- Consumes: `useSelection()` from Task 3.

- [ ] **Step 1: Add the checkbox**

In `app/protected/transactions/TransactionRow.tsx`, add the import (alongside the other `@/components/ui/*` imports):

```ts
import { Checkbox } from '@/components/ui/Checkbox'
```

and add this import next to the other local imports:

```ts
import { useSelection } from './SelectionContext'
```

Inside the component body, after the existing `const [pending, startTransition] = useTransition()` line, add:

```ts
const { isSelected, toggle } = useSelection()
```

Then wrap the existing left-hand info block in a flex row with the checkbox. Replace:

```tsx
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
        <div className="flex min-w-0 flex-col gap-1">
```

with:

```tsx
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
        <div className="flex min-w-0 items-start gap-3">
          <Checkbox
            className="mt-1"
            checked={isSelected(transaction.id)}
            onCheckedChange={() => toggle(transaction.id)}
            aria-label={t('selection.selectRow')}
          />
          <div className="flex min-w-0 flex-col gap-1">
```

and close the new wrapping `<div>` right before the closing of the info block — find:

```tsx
            {transaction.tags.length > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  {transaction.tags.map((tag) => `#${tag}`).join(' ')}
                </span>
              </>
            ) : null}
          </div>
        </div>
```

and change it to:

```tsx
            {transaction.tags.length > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  {transaction.tags.map((tag) => `#${tag}`).join(' ')}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>
```

(This closes the pre-existing `date/account/tags` div, the pre-existing outer info `div`, and the new checkbox-row `div` — three closes where there were previously two.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: fails with "useSelection must be used within a SelectionProvider" is a *runtime* error, not a type error — at this point it should type-check cleanly even though nothing renders `TransactionRow` inside a provider yet (that's Task 7).

- [ ] **Step 3: Commit**

```bash
git add app/protected/transactions/TransactionRow.tsx
git commit -m "feat(transactions): add per-row selection checkbox"
```

---

### Task 6: `BulkDeleteBar` — floating bar + confirm dialog

**Files:**
- Create: `app/protected/transactions/BulkDeleteBar.tsx`

**Interfaces:**
- Consumes: `useSelection()` from Task 3; `bulkDeleteTransactions` from Task 2 (`./actions`); `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription` from `@/components/ui/Dialog`; `Button` from `@/components/ui/Button`.

- [ ] **Step 1: Write the component**

Create `app/protected/transactions/BulkDeleteBar.tsx`:

```tsx
'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { bulkDeleteTransactions } from './actions'
import { useSelection } from './SelectionContext'

export function BulkDeleteBar() {
  const t = useTranslations('transactions')
  const {
    state,
    count,
    totalFiltered,
    filters,
    clear,
    selectAllMatchingFilter,
  } = useSelection()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (state.mode === 'none' || count === 0) {
    return null
  }

  const canExpandToFilter = state.mode === 'ids' && totalFiltered > count

  function handleConfirm() {
    const input =
      state.mode === 'ids'
        ? { mode: 'ids' as const, ids: Array.from(state.ids) }
        : {
            mode: 'filtered' as const,
            filters,
            excludeIds: Array.from(state.excludedIds),
          }
    setError(null)
    startTransition(async () => {
      const result = await bulkDeleteTransactions(input)
      if (!result.ok) {
        setError(t('errors.unexpected'))
        return
      }
      setConfirmOpen(false)
      clear()
    })
  }

  return (
    <>
      <div className="sticky bottom-4 z-40 flex items-center justify-between gap-4 rounded-2xl border border-glass-line bg-glass px-4 py-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-3 text-ink text-sm">
          <span>{t('selection.count', { count })}</span>
          {canExpandToFilter ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={selectAllMatchingFilter}
            >
              {t('selection.selectAllFiltered', { count: totalFiltered })}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            {t('selection.clear')}
          </Button>
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() => setConfirmOpen(true)}
        >
          {t('selection.deleteButton')}
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('selection.confirmTitle', { count })}</DialogTitle>
            <DialogDescription>{t('selection.confirmBody')}</DialogDescription>
          </DialogHeader>
          {error ? <p className="text-neg text-sm">{error}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setConfirmOpen(false)}
            >
              {t('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={handleConfirm}
            >
              {t('selection.deleteButton')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/protected/transactions/BulkDeleteBar.tsx
git commit -m "feat(transactions): add bulk-delete floating bar and confirm dialog"
```

---

### Task 7: Wire selection into the list and page

**Files:**
- Modify: `app/protected/transactions/transaction-list.tsx`
- Modify: `app/protected/transactions/page.tsx`

**Interfaces:**
- Consumes: `SelectionProvider` (Task 3), `SelectionHeader` (Task 4), `BulkDeleteBar` (Task 6), `hasActiveFilters` from `@finova/domain/transactions/filters` (already used in `page.tsx` today).

- [ ] **Step 1: Update `transaction-list.tsx`**

Replace the full contents of `app/protected/transactions/transaction-list.tsx` with:

```tsx
import { hasActiveFilters } from '@finova/domain/transactions/filters'
import type { TransactionFilters } from '@finova/domain/transactions/filters'
import { getTranslations } from 'next-intl/server'
import type { AccountRow } from '@/lib/validation/account'
import type { CategoryRow } from '@/lib/validation/category'
import type { TransactionRow } from '@/lib/validation/transaction'
import { BulkDeleteBar } from './BulkDeleteBar'
import { SelectionHeader } from './SelectionHeader'
import { SelectionProvider } from './SelectionContext'
import { TransactionRow as Row } from './TransactionRow'

/**
 * Presentational (server) list of transaction rows, newest first. Empty-state
 * polish is deferred to P4-06; this shows a plain message.
 */
export async function TransactionList({
  transactions,
  total,
  filters,
  accounts,
  categories,
  baseCurrency,
  todayIso,
}: {
  transactions: TransactionRow[]
  total: number
  filters: TransactionFilters
  accounts: AccountRow[]
  categories: CategoryRow[]
  baseCurrency: string
  todayIso: string
}) {
  const t = await getTranslations('transactions')

  if (transactions.length === 0) {
    return (
      <p className="text-ink-soft text-sm">
        {hasActiveFilters(filters) ? t('emptyFiltered') : t('empty')}
      </p>
    )
  }

  const pageIds = transactions.map((transaction) => transaction.id)

  return (
    <SelectionProvider
      pageIds={pageIds}
      totalFiltered={total}
      filters={filters}
    >
      <div className="flex flex-col gap-3">
        <SelectionHeader />
        {transactions.map((transaction) => (
          <Row
            key={transaction.id}
            transaction={transaction}
            accounts={accounts}
            categories={categories}
            baseCurrency={baseCurrency}
            todayIso={todayIso}
          />
        ))}
      </div>
      <BulkDeleteBar />
    </SelectionProvider>
  )
}
```

- [ ] **Step 2: Update `page.tsx`**

In `app/protected/transactions/page.tsx`, replace:

```tsx
      <TransactionList
        transactions={txnPage.rows}
        accounts={accounts}
        categories={categories}
        baseCurrency={baseCurrency}
        todayIso={todayIso}
        filtered={hasActiveFilters(filters)}
      />
```

with:

```tsx
      <TransactionList
        transactions={txnPage.rows}
        total={txnPage.total}
        filters={filters}
        accounts={accounts}
        categories={categories}
        baseCurrency={baseCurrency}
        todayIso={todayIso}
      />
```

`hasActiveFilters` is still imported in `page.tsx` for the `pageCount`/`filtered` logic elsewhere in the file — leave that import alone; only this one call site changes. (If `tsc`/Biome reports `hasActiveFilters` as an unused import in `page.tsx` after this edit, remove the import there — it's now only used inside `transaction-list.tsx`.)

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npx biome check app/protected/transactions`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/protected/transactions/transaction-list.tsx app/protected/transactions/page.tsx
git commit -m "feat(transactions): wire selection provider and bulk-delete bar into the list"
```

---

### Task 8: Manual verification

No code changes — this task confirms the feature actually works end to end, since server actions and page wiring have no automated test coverage in this codebase.

- [ ] **Step 1: Full test suite and build**

Run: `npx vitest run && npx tsc --noEmit && npx biome check .`
Expected: all green.

- [ ] **Step 2: Hand off for browser verification**

The sandbox this plan may be executed in cannot start a dev server or drive a browser. Ask Marc to run `npm run dev` and manually verify, on the `/protected/transactions` page:
- Checking individual row checkboxes shows the floating bar with the right count.
- The header checkbox selects/deselects the current page; partial page selection shows the indeterminate state.
- With a category or date filter active and more rows than fit on one page, "Select all N matching filter" appears once the page is fully selected, and clicking it updates the count to the full filtered total.
- Un-checking one row after "select all matching filter" reduces the count by exactly one without ever materializing a huge id list (open the network tab and confirm the eventual delete request is small regardless of selection size).
- Confirm dialog shows the correct count; Cancel closes it without deleting; Delete removes exactly that many rows, closes the dialog, and refreshes the list.
- Deleting from `ids` mode and from `all-filtered` mode both work and correctly scope to the current user (spot-check another test account is unaffected).

- [ ] **Step 3: Update PROGRESS.md**

Once manually verified, add an entry to `PROGRESS.md` noting bulk delete for transactions is done (follow the existing entry format in that file).
