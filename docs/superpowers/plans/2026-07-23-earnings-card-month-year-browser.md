# Earnings Card Month/Year Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Earnings card's single pinned "reference month" with genuine, URL-driven month and year navigation, fixing the bug where a salary transaction dated in a different month than the current one silently disappears.

**Architecture:** Two new pure helper modules in `packages/domain/src/dashboard/` (an earnings-category exclusion filter, and month/year period arithmetic), wired into `app/protected/page.tsx`'s existing `?period=`/`?granularity=` search-param pattern, feeding a rewritten `EarningsCard.tsx` that owns its own prev/next navigation the same way `PeriodSelector`/`GranularitySelector` already do.

**Tech Stack:** Next.js App Router (Server Components + `'use client'` components), next-intl, Vitest, Biome, TypeScript strict mode.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-23-earnings-card-month-year-browser-design.md`.
- Excluded-category mechanism stays name-key-based (`bizum_income`, `transactions_income`) plus `null` (uncategorized) — no new per-transaction flag (spec Non-goals).
- No projected/extrapolated full-year totals — a partial year shows its real sum-so-far, labeled as partial (spec Goals).
- Dividends and rent keep trailing-12-month averaging in month view only; year view uses real annual totals for every source (spec Goals).
- No changes to `is_transfer` handling, the Real Estate page's own cards, or the dashboard's `PeriodSelector`/`GranularitySelector` (spec Non-goals).
- This repo has no component/E2E test harness for `EarningsCard` today — verification is `tsc --noEmit`, `biome check`, the domain Vitest suite, and a manual browser QA checklist (sandboxed dev environment can't drive a browser itself).

---

### Task 1: Domain — earnings category exclusion filter

**Files:**
- Create: `packages/domain/src/dashboard/earnings.ts`
- Create: `packages/domain/src/dashboard/earnings.test.ts`
- Modify: `packages/domain/src/dashboard/index.ts`

**Interfaces:**
- Produces: `isEarningCategory(categoryId: string | null, nameKey: string | null | undefined): boolean`, `EARNINGS_EXCLUDED_CATEGORY_NAME_KEYS: ReadonlySet<string>` — both exported from `@finova/domain/dashboard`.

- [ ] **Step 1: Write the failing test**

Create `packages/domain/src/dashboard/earnings.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isEarningCategory } from './earnings'

describe('isEarningCategory', () => {
  it('excludes uncategorized transactions', () => {
    expect(isEarningCategory(null, undefined)).toBe(false)
  })

  it('excludes bizum_income', () => {
    expect(isEarningCategory('cat-1', 'bizum_income')).toBe(false)
  })

  it('excludes transactions_income', () => {
    expect(isEarningCategory('cat-1', 'transactions_income')).toBe(false)
  })

  it('includes salary', () => {
    expect(isEarningCategory('cat-1', 'salary')).toBe(true)
  })

  it('includes a custom user category (null name_key, but a real category_id)', () => {
    expect(isEarningCategory('cat-1', null)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/domain/src/dashboard/earnings.test.ts`
Expected: FAIL — `Cannot find module './earnings'`.

- [ ] **Step 3: Write the implementation**

Create `packages/domain/src/dashboard/earnings.ts`:

```ts
/**
 * Which categories count toward the Earnings card's "how much do I earn"
 * total. Excluded categories still count as income everywhere else in the
 * app (transaction totals, spending/income charts) — this filter is
 * Earnings-card-only.
 */

/**
 * `name_key`s that are ambiguous incoming money (a Bizum/reimbursement, or
 * the generic incoming-transfer catch-all) rather than confirmed earnings.
 * A user who wants a specific transaction of these kinds to count recategorizes
 * it to a real income category (Salary, Gifts, Other income) — that already
 * makes it count, since this filter only looks at the assigned category.
 */
export const EARNINGS_EXCLUDED_CATEGORY_NAME_KEYS: ReadonlySet<string> =
  new Set(['bizum_income', 'transactions_income'])

/**
 * Whether a transaction's category counts as an "earning": it must have a
 * real category assigned (uncategorized is excluded — ambiguous until the
 * user picks one) and that category must not be one of the excluded
 * ambiguous-transfer buckets.
 */
export function isEarningCategory(
  categoryId: string | null,
  nameKey: string | null | undefined
): boolean {
  if (categoryId === null) {
    return false
  }
  return !EARNINGS_EXCLUDED_CATEGORY_NAME_KEYS.has(nameKey ?? '')
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run packages/domain/src/dashboard/earnings.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Export from the dashboard barrel**

In `packages/domain/src/dashboard/index.ts`, add (alphabetically, after the `./display-currency` export and before the `./key-stats` export, matching the file's existing alphabetical-by-source ordering):

```ts
export {
  EARNINGS_EXCLUDED_CATEGORY_NAME_KEYS,
  isEarningCategory,
} from './earnings'
```

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit -p .`
Expected: no output (success).

Run: `npx biome check packages/domain/src/dashboard/earnings.ts packages/domain/src/dashboard/earnings.test.ts packages/domain/src/dashboard/index.ts`
Expected: `Checked 3 files in ...ms. No fixes applied.`

- [ ] **Step 7: Commit**

```bash
git add packages/domain/src/dashboard/earnings.ts packages/domain/src/dashboard/earnings.test.ts packages/domain/src/dashboard/index.ts
git commit -m "$(cat <<'EOF'
feat(dashboard): add isEarningCategory exclusion filter

Pure predicate for which categories count toward the Earnings card's
income total — uncategorized and ambiguous-transfer buckets excluded,
everything else (including any category a user assigns) counts.
EOF
)"
```

---

### Task 2: Domain — month/year period helpers

**Files:**
- Create: `packages/domain/src/dashboard/earnings-period.ts`
- Create: `packages/domain/src/dashboard/earnings-period.test.ts`
- Modify: `packages/domain/src/dashboard/index.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces (all exported from `@finova/domain/dashboard`): `type EarningsView = 'month' | 'year'`, `dayBeforeIso(iso: string): string`, `monthRangeIso(month: string): { start: string; endExclusive: string }`, `yearRangeIso(year: string): { start: string; endExclusive: string }`, `periodRangeIso(view: EarningsView, period: string): { start: string; endExclusive: string }`, `periodEndIso(view: EarningsView, period: string, todayIso: string): string`, `trailingYearStartIso(asOfIso: string): string`, `shiftPeriod(view: EarningsView, period: string, delta: number): string`, `currentPeriod(view: EarningsView, todayIso: string): string`, `parseEarningsView(raw: string | undefined): EarningsView`, `parseEarningsPeriod(raw: string | undefined, view: EarningsView, todayIso: string): string`, `clampPeriod(period: string, earliest: string, latest: string): string`, `earliestIso(dates: string[]): string | null`.

- [ ] **Step 1: Write the failing tests**

Create `packages/domain/src/dashboard/earnings-period.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  clampPeriod,
  currentPeriod,
  dayBeforeIso,
  earliestIso,
  monthRangeIso,
  parseEarningsPeriod,
  parseEarningsView,
  periodEndIso,
  periodRangeIso,
  shiftPeriod,
  trailingYearStartIso,
  yearRangeIso,
} from './earnings-period'

describe('dayBeforeIso', () => {
  it('subtracts one day, crossing a month boundary', () => {
    expect(dayBeforeIso('2026-07-01')).toBe('2026-06-30')
  })
})

describe('monthRangeIso', () => {
  it('returns the month start and the next month start', () => {
    expect(monthRangeIso('2026-02')).toEqual({
      start: '2026-02-01',
      endExclusive: '2026-03-01',
    })
  })
})

describe('yearRangeIso', () => {
  it('returns the year start and the next year start', () => {
    expect(yearRangeIso('2025')).toEqual({
      start: '2025-01-01',
      endExclusive: '2026-01-01',
    })
  })
})

describe('periodRangeIso', () => {
  it('delegates to monthRangeIso for month view', () => {
    expect(periodRangeIso('month', '2026-02')).toEqual(
      monthRangeIso('2026-02')
    )
  })

  it('delegates to yearRangeIso for year view', () => {
    expect(periodRangeIso('year', '2025')).toEqual(yearRangeIso('2025'))
  })
})

describe('periodEndIso', () => {
  it('returns the inclusive month end when fully in the past', () => {
    expect(periodEndIso('month', '2026-02', '2026-07-23')).toBe('2026-02-28')
  })

  it('clips the current month to today', () => {
    expect(periodEndIso('month', '2026-07', '2026-07-23')).toBe('2026-07-23')
  })

  it('clips the current year to today', () => {
    expect(periodEndIso('year', '2026', '2026-07-23')).toBe('2026-07-23')
  })

  it('returns the inclusive year end when fully in the past', () => {
    expect(periodEndIso('year', '2025', '2026-07-23')).toBe('2025-12-31')
  })
})

describe('trailingYearStartIso', () => {
  it('returns the day after one year before asOf', () => {
    expect(trailingYearStartIso('2026-07-23')).toBe('2025-07-24')
  })
})

describe('shiftPeriod', () => {
  it('shifts a month forward within the same year', () => {
    expect(shiftPeriod('month', '2026-06', 1)).toBe('2026-07')
  })

  it('shifts a month backward across a year boundary', () => {
    expect(shiftPeriod('month', '2026-01', -1)).toBe('2025-12')
  })

  it('shifts a month forward across a year boundary', () => {
    expect(shiftPeriod('month', '2025-12', 1)).toBe('2026-01')
  })

  it('shifts a year', () => {
    expect(shiftPeriod('year', '2026', -1)).toBe('2025')
  })
})

describe('currentPeriod', () => {
  it('returns YYYY-MM for month view', () => {
    expect(currentPeriod('month', '2026-07-23')).toBe('2026-07')
  })

  it('returns YYYY for year view', () => {
    expect(currentPeriod('year', '2026-07-23')).toBe('2026')
  })
})

describe('parseEarningsView', () => {
  it('accepts "year"', () => {
    expect(parseEarningsView('year')).toBe('year')
  })

  it('defaults to "month" for anything else', () => {
    expect(parseEarningsView('bogus')).toBe('month')
    expect(parseEarningsView(undefined)).toBe('month')
  })
})

describe('parseEarningsPeriod', () => {
  it('accepts a well-formed month', () => {
    expect(parseEarningsPeriod('2026-03', 'month', '2026-07-23')).toBe(
      '2026-03'
    )
  })

  it('accepts a well-formed year', () => {
    expect(parseEarningsPeriod('2025', 'year', '2026-07-23')).toBe('2025')
  })

  it('falls back to the current period when missing', () => {
    expect(parseEarningsPeriod(undefined, 'month', '2026-07-23')).toBe(
      '2026-07'
    )
  })

  it('falls back to the current period when malformed', () => {
    expect(parseEarningsPeriod('not-a-month', 'month', '2026-07-23')).toBe(
      '2026-07'
    )
    expect(parseEarningsPeriod('2026-03', 'year', '2026-07-23')).toBe('2026')
  })
})

describe('clampPeriod', () => {
  it('passes through a period within bounds', () => {
    expect(clampPeriod('2026-03', '2024-01', '2026-07')).toBe('2026-03')
  })

  it('clamps below the earliest bound', () => {
    expect(clampPeriod('2020-01', '2024-01', '2026-07')).toBe('2024-01')
  })

  it('clamps above the latest bound', () => {
    expect(clampPeriod('2030-01', '2024-01', '2026-07')).toBe('2026-07')
  })
})

describe('earliestIso', () => {
  it('returns null for an empty list', () => {
    expect(earliestIso([])).toBeNull()
  })

  it('returns the lexically (and chronologically) smallest date', () => {
    expect(earliestIso(['2026-03-01', '2024-06-15', '2025-01-01'])).toBe(
      '2024-06-15'
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run packages/domain/src/dashboard/earnings-period.test.ts`
Expected: FAIL — `Cannot find module './earnings-period'`.

- [ ] **Step 3: Write the implementation**

Create `packages/domain/src/dashboard/earnings-period.ts`:

```ts
/**
 * Pure month/year period arithmetic for the Earnings card's browsable
 * month/year navigation. ISO date strings only — no `Date` objects escape
 * this module except internally for UTC-safe day/month arithmetic.
 */

export type EarningsView = 'month' | 'year'

const MONTH_PATTERN = /^\d{4}-\d{2}$/
const YEAR_PATTERN = /^\d{4}$/

/** `iso` minus one day, UTC-safe (correctly crosses month/year boundaries). */
export function dayBeforeIso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
}

/** `[start, endExclusive)` for a `YYYY-MM` month. */
export function monthRangeIso(month: string): {
  start: string
  endExclusive: string
} {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return {
    start: `${month}-01`,
    endExclusive: new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10),
  }
}

/** `[start, endExclusive)` for a `YYYY` calendar year. */
export function yearRangeIso(year: string): {
  start: string
  endExclusive: string
} {
  return {
    start: `${year}-01-01`,
    endExclusive: `${Number(year) + 1}-01-01`,
  }
}

/** `[start, endExclusive)` for either a `YYYY-MM` month or `YYYY` year. */
export function periodRangeIso(
  view: EarningsView,
  period: string
): { start: string; endExclusive: string } {
  return view === 'month' ? monthRangeIso(period) : yearRangeIso(period)
}

/**
 * Inclusive end of the period, clipped to `todayIso` so an in-progress
 * month/year never reaches into the future.
 */
export function periodEndIso(
  view: EarningsView,
  period: string,
  todayIso: string
): string {
  const { endExclusive } = periodRangeIso(view, period)
  const inclusiveEnd = dayBeforeIso(endExclusive)
  return inclusiveEnd < todayIso ? inclusiveEnd : todayIso
}

/** Start of the trailing 12-month window ending at `asOfIso`, inclusive. */
export function trailingYearStartIso(asOfIso: string): string {
  const [y, m, d] = asOfIso.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y - 1, m - 1, d + 1)).toISOString().slice(0, 10)
}

/** `period` shifted by `delta` months (month view) or years (year view). */
export function shiftPeriod(
  view: EarningsView,
  period: string,
  delta: number
): string {
  if (view === 'year') {
    return String(Number(period) + delta)
  }
  const [y, m] = period.split('-').map(Number) as [number, number]
  const total = y * 12 + (m - 1) + delta
  const nextYear = Math.floor(total / 12)
  const nextMonth = ((total % 12) + 12) % 12
  return `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`
}

/** The current `YYYY-MM` or `YYYY` period, per `todayIso`. */
export function currentPeriod(view: EarningsView, todayIso: string): string {
  return view === 'month' ? todayIso.slice(0, 7) : todayIso.slice(0, 4)
}

/** `'month'` unless `raw` is exactly `'year'`. */
export function parseEarningsView(raw: string | undefined): EarningsView {
  return raw === 'year' ? 'year' : 'month'
}

/**
 * Validates `raw` against `view`'s expected shape (`YYYY-MM` / `YYYY`),
 * falling back to the current period when missing or malformed.
 */
export function parseEarningsPeriod(
  raw: string | undefined,
  view: EarningsView,
  todayIso: string
): string {
  if (raw === undefined) {
    return currentPeriod(view, todayIso)
  }
  const pattern = view === 'month' ? MONTH_PATTERN : YEAR_PATTERN
  return pattern.test(raw) ? raw : currentPeriod(view, todayIso)
}

/**
 * Clamps `period` to `[earliest, latest]`. Lexical string comparison matches
 * calendar order for both `YYYY-MM` and `YYYY` shapes (zero-padded, same
 * length), so no date parsing is needed.
 */
export function clampPeriod(
  period: string,
  earliest: string,
  latest: string
): string {
  if (period < earliest) {
    return earliest
  }
  if (period > latest) {
    return latest
  }
  return period
}

/** Earliest ISO date in `dates`, or `null` if empty. Lexical min == chronological min. */
export function earliestIso(dates: string[]): string | null {
  return dates.length === 0 ? null : dates.reduce((a, b) => (a < b ? a : b))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/domain/src/dashboard/earnings-period.test.ts`
Expected: PASS (20 tests).

- [ ] **Step 5: Export from the dashboard barrel**

In `packages/domain/src/dashboard/index.ts`, add (alphabetically, right after the `./earnings` export block added in Task 1):

```ts
export {
  clampPeriod,
  currentPeriod,
  dayBeforeIso,
  earliestIso,
  type EarningsView,
  monthRangeIso,
  parseEarningsPeriod,
  parseEarningsView,
  periodEndIso,
  periodRangeIso,
  shiftPeriod,
  trailingYearStartIso,
  yearRangeIso,
} from './earnings-period'
```

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit -p .`
Expected: no output (success).

Run: `npx biome check packages/domain/src/dashboard/earnings-period.ts packages/domain/src/dashboard/earnings-period.test.ts packages/domain/src/dashboard/index.ts`
Expected: `Checked 3 files in ...ms. No fixes applied.`

- [ ] **Step 7: Commit**

```bash
git add packages/domain/src/dashboard/earnings-period.ts packages/domain/src/dashboard/earnings-period.test.ts packages/domain/src/dashboard/index.ts
git commit -m "$(cat <<'EOF'
feat(dashboard): add month/year period helpers for Earnings card

Pure range/shift/clamp/parse helpers so the Earnings card can browse
real months and years instead of pinning to one reference month.
EOF
)"
```

---

### Task 3: i18n — navigation and year-footer message keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`

**Interfaces:**
- Consumes: nothing from Tasks 1–2.
- Produces: new keys under `dashboard.earnings` — `nav.prevMonth`, `nav.nextMonth`, `nav.prevYear`, `nav.nextYear`, `basedOnYear`, `basedOnYearSoFar` — consumed by Task 4's `EarningsCard.tsx`.

- [ ] **Step 1: Add the keys to `messages/en.json`**

Find the existing `dashboard.earnings` block (currently):

```json
    "earnings": {
      "title": "How much do I earn?",
      "units": {
        "day": "Per day",
        "month": "Per month",
        "year": "Per year"
      },
      "per": {
        "day": "/ day",
        "month": "/ month",
        "year": "/ year"
      },
      "empty": "No income recorded yet.",
      "basedOn": "Based on your income in {month}. Per day divides it by the days in the month; per year multiplies it by 12."
    }
```

Replace it with:

```json
    "earnings": {
      "title": "How much do I earn?",
      "units": {
        "day": "Per day",
        "month": "Per month",
        "year": "Per year"
      },
      "per": {
        "day": "/ day",
        "month": "/ month",
        "year": "/ year"
      },
      "nav": {
        "prevMonth": "Previous month",
        "nextMonth": "Next month",
        "prevYear": "Previous year",
        "nextYear": "Next year"
      },
      "empty": "No income recorded yet.",
      "basedOn": "Based on your income in {month}. Per day divides it by the days in the month.",
      "basedOnYear": "Based on your income in {year}.",
      "basedOnYearSoFar": "Based on your income so far in {year} — the year isn't over yet."
    }
```

(Note: `basedOn`'s trailing clause about multiplying by 12 is removed — year totals are now real annual sums, not derived from the month, so that sentence would be inaccurate.)

- [ ] **Step 2: Add the keys to `messages/es.json`**

Find the existing `dashboard.earnings` block (currently):

```json
    "earnings": {
      "title": "¿Cuánto gano?",
      "units": {
        "day": "Por día",
        "month": "Por mes",
        "year": "Por año"
      },
      "per": {
        "day": "/ día",
        "month": "/ mes",
        "year": "/ año"
      },
      "empty": "Aún no hay ingresos registrados.",
      "basedOn": "Basado en tus ingresos de {month}. Por día lo divide entre los días del mes; por año lo multiplica por 12."
    }
```

Replace it with:

```json
    "earnings": {
      "title": "¿Cuánto gano?",
      "units": {
        "day": "Por día",
        "month": "Por mes",
        "year": "Por año"
      },
      "per": {
        "day": "/ día",
        "month": "/ mes",
        "year": "/ año"
      },
      "nav": {
        "prevMonth": "Mes anterior",
        "nextMonth": "Mes siguiente",
        "prevYear": "Año anterior",
        "nextYear": "Año siguiente"
      },
      "empty": "Aún no hay ingresos registrados.",
      "basedOn": "Basado en tus ingresos de {month}. Por día lo divide entre los días del mes.",
      "basedOnYear": "Basado en tus ingresos de {year}.",
      "basedOnYearSoFar": "Basado en tus ingresos de lo que va de {year} — el año todavía no ha terminado."
    }
```

- [ ] **Step 3: Verify both files are still valid JSON and lint clean**

Run: `npx biome check messages/en.json messages/es.json`
Expected: `Checked 2 files in ...ms. No fixes applied.`

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "$(cat <<'EOF'
i18n: add Earnings card navigation and year-footer strings

New keys for the month/year prev-next arrows and the year-view footer
text, in both locales, ahead of wiring them into EarningsCard.
EOF
)"
```

---

### Task 4: `EarningsCard.tsx` and `page.tsx` — wire month/year navigation

**Files:**
- Modify: `app/protected/EarningsCard.tsx` (full rewrite)
- Modify: `app/protected/page.tsx:74-78` (searchParams type), `:147-192` (dedupe `dayBeforeIso`), `:332-494` (earnings aggregation block), `:635-641` (render call)

**Interfaces:**
- Consumes: `isEarningCategory` (Task 1); `EarningsView`, `dayBeforeIso`, `periodRangeIso`, `periodEndIso`, `trailingYearStartIso`, `shiftPeriod`, `currentPeriod`, `parseEarningsView`, `parseEarningsPeriod`, `clampPeriod`, `earliestIso` (Task 2); `dashboard.earnings.nav.*`, `dashboard.earnings.basedOnYear`, `dashboard.earnings.basedOnYearSoFar` (Task 3).
- Produces: `EarningsCard` props change from `{ rows, monthIso, daysInMonth, currency, className }` to `{ rows, view, period, canGoPrev, canGoNext, isPartialYear, currency, className }` — this is a breaking prop-shape change, so this task must land both files together (`page.tsx`'s render call is the only caller).

- [ ] **Step 1: Rewrite `EarningsCard.tsx`**

Replace the full contents of `app/protected/EarningsCard.tsx`:

```tsx
'use client'

import { format, money } from '@finova/domain/money'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { type ReactNode, useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { GlassCard } from '@/components/ui/GlassCard'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { cn } from '@/lib/utils'

export interface EarningsRow {
  /** Amount earned in the selected period, integer cents. */
  cents: number
  icon?: ReactNode
  key: string
  label: string
}

export type EarningsView = 'month' | 'year'
type Unit = 'day' | 'month' | 'year'
const UNITS: Unit[] = ['day', 'month', 'year']

/**
 * "How much do I earn?" — browsable by month (Día/Mes) or year (Año), via
 * the `?earningsView=`/`?earningsPeriod=` search params (same pattern as
 * `PeriodSelector`/`GranularitySelector` elsewhere on this page). In month
 * view, "Día" is that month's total ÷ days in that month; in year view the
 * total is the real annual sum the server computed — no client-side
 * multiplication.
 */
export function EarningsCard({
  rows,
  view,
  period,
  canGoPrev,
  canGoNext,
  isPartialYear,
  currency,
  className,
}: {
  rows: EarningsRow[]
  view: EarningsView
  /** `YYYY-MM` in month view, `YYYY` in year view. */
  period: string
  canGoPrev: boolean
  canGoNext: boolean
  isPartialYear: boolean
  currency: string
  className?: string
}) {
  const t = useTranslations('dashboard.earnings')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [monthUnit, setMonthUnit] = useState<'day' | 'month'>('month')

  const unit: Unit = view === 'year' ? 'year' : monthUnit

  const navigate = (nextView: EarningsView, nextPeriod?: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('earningsView', nextView)
    if (nextPeriod) {
      params.set('earningsPeriod', nextPeriod)
    } else {
      params.delete('earningsPeriod')
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const onUnitChange = (next: string) => {
    if (next === 'year') {
      if (view !== 'year') {
        navigate('year')
      }
      return
    }
    setMonthUnit(next as 'day' | 'month')
    if (view !== 'month') {
      navigate('month')
    }
  }

  const shift = (delta: number) => {
    if (view === 'year') {
      navigate('year', String(Number(period) + delta))
      return
    }
    const [y, m] = period.split('-').map(Number) as [number, number]
    const total = y * 12 + (m - 1) + delta
    const nextYear = Math.floor(total / 12)
    const nextMonth = ((total % 12) + 12) % 12
    navigate('month', `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`)
  }

  const daysInMonth =
    view === 'month'
      ? (() => {
          const [y, m] = period.split('-').map(Number) as [number, number]
          return new Date(Date.UTC(y, m, 0)).getUTCDate()
        })()
      : 30

  const convert = (cents: number): number =>
    view === 'month' && unit === 'day' ? Math.round(cents / daysInMonth) : cents

  const totalCents = rows.reduce((sum, r) => sum + r.cents, 0)
  const periodLabel =
    view === 'month'
      ? new Date(`${period}-01T00:00:00Z`).toLocaleDateString(locale, {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : period

  return (
    <GlassCard className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
          {t('title')}
        </h3>
        <div className="flex items-center gap-1">
          <Button
            aria-label={view === 'month' ? t('nav.prevMonth') : t('nav.prevYear')}
            variant="ghost"
            size="icon"
            disabled={!canGoPrev}
            onClick={() => shift(-1)}
          >
            <ChevronLeft />
          </Button>
          <SegmentedControl
            aria-label={t('title')}
            value={unit}
            onValueChange={onUnitChange}
            options={UNITS.map((u) => ({ label: t(`units.${u}`), value: u }))}
          />
          <Button
            aria-label={view === 'month' ? t('nav.nextMonth') : t('nav.nextYear')}
            variant="ghost"
            size="icon"
            disabled={!canGoNext}
            onClick={() => shift(1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-display font-semibold text-3xl text-ink tabular-nums">
          {format(money(convert(totalCents), currency), locale)}
        </span>
        <span className="text-ink-soft text-sm">{t(`per.${unit}`)}</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-ink-soft text-sm">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-ink text-sm">
                {r.icon}
                <span className="truncate">{r.label}</span>
              </span>
              <span className="shrink-0 font-medium text-ink text-sm tabular-nums">
                {format(money(convert(r.cents), currency), locale)}
                <span className="ml-2 text-ink-soft text-xs">
                  {totalCents > 0
                    ? `${Math.round((r.cents / totalCents) * 100)}%`
                    : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-ink-soft text-xs">
        {view === 'month'
          ? t('basedOn', { month: periodLabel })
          : isPartialYear
            ? t('basedOnYearSoFar', { year: period })
            : t('basedOnYear', { year: period })}
      </p>
    </GlassCard>
  )
}
```

- [ ] **Step 2: Update `page.tsx`'s `searchParams` type**

In `app/protected/page.tsx`, find:

```tsx
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ granularity?: string; period?: string }>
}) {
```

Replace with:

```tsx
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    granularity?: string
    period?: string
    earningsView?: string
    earningsPeriod?: string
  }>
}) {
```

- [ ] **Step 3: Import the new domain helpers**

In `app/protected/page.tsx`, find the existing dashboard import block (lines 2–24):

```tsx
import {
  accountBalances,
  balanceTrend,
  balanceTrendToArea,
  filterByPeriod,
  incomeByCategory,
  incomeExpenseSeries,
  keyStats,
  monthlySeriesToBars,
  parseGranularity,
  parsePeriod,
  pctChange,
  periodStartIso,
  pickDisplayCurrency,
  previousPeriodRange,
  previousPeriodTxns,
  savingsRate,
  spendingByAccount,
  spendingByCategory,
  spendingToDonut,
  totalBalanceByCurrency,
  trendOf,
} from '@finova/domain/dashboard'
```

Replace with:

```tsx
import {
  accountBalances,
  balanceTrend,
  balanceTrendToArea,
  clampPeriod,
  currentPeriod,
  dayBeforeIso,
  earliestIso,
  type EarningsView,
  filterByPeriod,
  incomeByCategory,
  incomeExpenseSeries,
  isEarningCategory,
  keyStats,
  monthlySeriesToBars,
  parseEarningsPeriod,
  parseEarningsView,
  parseGranularity,
  parsePeriod,
  pctChange,
  periodEndIso,
  periodRangeIso,
  periodStartIso,
  pickDisplayCurrency,
  previousPeriodRange,
  previousPeriodTxns,
  savingsRate,
  spendingByAccount,
  spendingByCategory,
  spendingToDonut,
  totalBalanceByCurrency,
  trailingYearStartIso,
  trendOf,
} from '@finova/domain/dashboard'
```

- [ ] **Step 4: Remove the local `dayBeforeIso` definition (now imported)**

In `app/protected/page.tsx`, find (inside the rent/dividend-folding block, right after `propertyLoanSnapshots`):

```tsx
  const dayBeforeIso = (iso: string): string => {
    const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
    return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
  }
  const EARLIEST_ISO = '1900-01-01'
```

Replace with:

```tsx
  const EARLIEST_ISO = '1900-01-01'
```

(`dayBeforeIso` is now the one imported from `@finova/domain/dashboard` in Step 3 — its two existing call sites, `rentIn` and `manualIncomeIn` just below, are unchanged since the name and signature are identical.)

- [ ] **Step 5: Replace the earnings aggregation block**

In `app/protected/page.tsx`, find the entire block starting at the comment `// Earnings card: one concrete reference month...` and ending right before `const accountById = new Map(...)`. This spans from:

```tsx
  // Earnings card: one concrete reference month (e.g. "salary in June"),
```

through (inclusive):

```tsx
  const [ey, em] = earningsMonth.split('-').map(Number) as [number, number]
  const earningsDaysInMonth = new Date(Date.UTC(ey, em, 0)).getUTCDate()
```

Replace that entire block with:

```tsx
  // Earnings card: browsable by month or year via ?earningsView=/
  // ?earningsPeriod= (mirrors the ?period=/?granularity= pattern above),
  // instead of pinning to one "reference month". A transaction's earnings
  // category is looked up in whichever period is actually selected, so a
  // salary payment from a past month is never silently skipped just because
  // the current month happens to have other income.
  const earningsView: EarningsView = parseEarningsView(params.earningsView)
  const earningsCurrentPeriod = currentPeriod(earningsView, todayIso)
  const earningsEarliestIso = earliestIso([
    ...txns.map((x) => x.occurred_at.slice(0, 10)),
    ...rentEvents.map((e) => e.periodStart),
    ...(invIncome.baseCurrency === currency
      ? invIncome.receivedEventsBase.map((e) => e.date)
      : []),
    ...manualAssetIncomeEvents.map((e) => e.receivedDate),
  ])
  const earningsEarliestPeriod = earningsEarliestIso
    ? earningsEarliestIso.slice(0, earningsView === 'month' ? 7 : 4)
    : earningsCurrentPeriod
  const earningsPeriod = clampPeriod(
    parseEarningsPeriod(params.earningsPeriod, earningsView, todayIso),
    earningsEarliestPeriod,
    earningsCurrentPeriod
  )
  const earningsCanGoPrev = earningsPeriod > earningsEarliestPeriod
  const earningsCanGoNext = earningsPeriod < earningsCurrentPeriod
  const earningsIsPartialYear =
    earningsView === 'year' && earningsPeriod === earningsCurrentPeriod

  const { start: earningsPeriodStart } = periodRangeIso(
    earningsView,
    earningsPeriod
  )
  const earningsPeriodEnd = periodEndIso(earningsView, earningsPeriod, todayIso)

  const earningsPeriodTxns = txns.filter(
    (x) =>
      x.occurred_at.slice(0, 10) >= earningsPeriodStart &&
      x.occurred_at.slice(0, 10) <= earningsPeriodEnd
  )
  const earningTxns = earningsPeriodTxns.filter((x) =>
    isEarningCategory(x.category_id, byId.get(x.category_id ?? '')?.name_key)
  )

  // Dividends/coupons/interest and rent are lumpy/prorated, not naturally
  // monthly — in month view, average the trailing 12 months ending at the
  // selected month (the same "typical monthly amount" idea as the
  // Investments page's forward-annual estimate, and matching the Real
  // Estate page's own "monthly cash flow" figure for rent); in year view,
  // use the real total received/earned in that calendar year, since a full
  // year isn't lumpy the way one month can be.
  const earningsTrailingStart =
    earningsView === 'month'
      ? trailingYearStartIso(earningsPeriodEnd)
      : earningsPeriodStart

  const earningsDividendCents = ((): number => {
    if (invIncome.baseCurrency !== currency) {
      return 0
    }
    const total = invIncome.receivedEventsBase
      .filter(
        (e) => e.date >= earningsTrailingStart && e.date <= earningsPeriodEnd
      )
      .reduce((sum, e) => sum + e.cents, 0)
    return earningsView === 'month' ? Math.round(total / 12) : total
  })()

  const earningsRentCents = ((): number => {
    const total = cashFlowCents(
      rentEvents,
      propertyExpenseEvents,
      propertyLoanSnapshots,
      earningsTrailingStart,
      earningsPeriodEnd
    )
    return earningsView === 'month' ? Math.round(total / 12) : total
  })()

  const earningsManualAssetIncomeCents = ((): number => {
    const total = manualAssetIncomeInRangeCents(
      manualAssetIncomeEvents,
      earningsTrailingStart,
      earningsPeriodEnd
    )
    return earningsView === 'month' ? Math.round(total / 12) : total
  })()

  const earningsRows = [
    ...(incomeByCategory(earningTxns)[currency] ?? []).map((s) => ({
      key: s.categoryId ?? '__uncategorized__',
      label: labelFor(s.categoryId),
      icon: iconFor(s.categoryId),
      cents: s.total,
    })),
    ...(earningsDividendCents > 0
      ? [
          {
            key: '__dividends__',
            label: t('ranking.dividends'),
            icon: <CategoryIcon iconName="HandCoins" />,
            cents: earningsDividendCents,
          },
        ]
      : []),
    ...(earningsRentCents > 0
      ? [
          {
            key: '__rent__',
            label: t('ranking.rent'),
            icon: <CategoryIcon iconName="Home" />,
            cents: earningsRentCents,
          },
        ]
      : []),
    ...(earningsManualAssetIncomeCents > 0
      ? [
          {
            key: '__manual_assets_income__',
            label: t('ranking.manualAssetsIncome'),
            icon: <CategoryIcon iconName="Landmark" />,
            cents: earningsManualAssetIncomeCents,
          },
        ]
      : []),
  ].sort((a, b) => b.cents - a.cents)
```

- [ ] **Step 6: Update the `EarningsCard` render call**

In `app/protected/page.tsx`, find:

```tsx
        <EarningsCard
          className="col-span-12"
          rows={earningsRows}
          monthIso={earningsMonth}
          daysInMonth={earningsDaysInMonth}
          currency={currency}
        />
```

Replace with:

```tsx
        <EarningsCard
          className="col-span-12"
          rows={earningsRows}
          view={earningsView}
          period={earningsPeriod}
          canGoPrev={earningsCanGoPrev}
          canGoNext={earningsCanGoNext}
          isPartialYear={earningsIsPartialYear}
          currency={currency}
        />
```

- [ ] **Step 7: Typecheck and lint**

Run: `npx tsc --noEmit -p .`
Expected: no output (success). If there are errors, they're almost always a leftover reference to a removed identifier (`earningsMonth`, `earningsDaysInMonth`, `monthRange`, `monthAsOfIso`, `EARNINGS_EXCLUDED_CATEGORIES`, `monthEarningTxns`, `dividendMonthCents`, `rentMonthCents`, `manualAssetIncomeMonthCents`, `earningMonths`, `monthsInRange`, `monthTxns`) — search for the name in `page.tsx` and remove the stale reference; all of these were part of the block deleted in Step 5.

Run: `npx biome check app/protected/EarningsCard.tsx app/protected/page.tsx`
Expected: `Checked 2 files in ...ms. No fixes applied.`

- [ ] **Step 8: Commit**

```bash
git add app/protected/EarningsCard.tsx app/protected/page.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): browsable month/year navigation for Earnings card

Replaces the single pinned "reference month" with real prev/next
navigation (?earningsView=/?earningsPeriod=), fixing the bug where a
salary transaction dated in a different month than the current one
silently disappeared. Year view shows real annual totals; month view
keeps trailing-12-month averaging for dividends/rent, which stay lumpy
on a single-month basis.
EOF
)"
```

---

### Task 5: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full relevant domain test suite**

Run: `npx vitest run packages/domain/src/dashboard packages/domain/src/real-estate packages/domain/src/categories`
Expected: all test files pass, including the two new ones from Tasks 1–2.

- [ ] **Step 2: Full-repo typecheck and lint**

Run: `npx tsc --noEmit -p .`
Expected: no output (success).

Run: `npx biome check .`
Expected: `Checked <N> files in ...ms. No fixes applied.`

- [ ] **Step 3: Manual browser QA checklist**

This sandboxed environment cannot start a dev server or drive a browser (per this project's known constraint — no socket listen). Hand this checklist to a human running `npm run dev` locally:

- Open the dashboard. Confirm the Earnings card defaults to the current month, matching today's real transactions (a salary transaction dated in a past month should NOT appear when viewing the current month, since it belongs to that other month — this is correct, not a regression).
- Click the left arrow next to Día/Mes/Año. Confirm it steps back one month and shows that month's real transaction-based rows (salary should now appear if it's dated in the displayed month) plus the trailing-12-month dividend/rent/manual-asset figures.
- Keep clicking left until reaching the earliest month with any account activity; confirm the left arrow becomes disabled (not hidden) and doesn't error.
- Click right repeatedly back to the current month; confirm the right arrow disables at the current month (no browsing into the future).
- Click "Año". Confirm it shows the current year's real total-so-far, with the "so far" footer text, and that the figure differs from (is not simply 12× or ÷12 of) the month view's figure.
- Use Año's arrows to go to a past, fully-elapsed year; confirm the footer text switches to the non-"so far" wording and the total reflects the whole year.
- Confirm a month/year with zero income shows €0 and the existing empty-state message rather than erroring or looking broken.
- Confirm an uncategorized incoming transaction never appears as an Earnings row in any month/year, and that recategorizing it (via the Transactions page dropdown) to "Other income" or "Salary" makes it appear the next time that period is viewed.
- Switch the locale (ES/EN) and confirm all new strings (arrows' `aria-label`, year footer text) are translated, not showing raw keys.
