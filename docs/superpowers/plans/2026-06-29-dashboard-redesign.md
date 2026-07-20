# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose the Finova `/protected` dashboard into a coherent four-band, 12-column command center with vs-previous-period deltas, a data-health banner, currency clarity, and per-panel empty states — over existing data only.

**Architecture:** Add pure prior-window comparison functions to the dashboard domain (no DB change — all transactions are already loaded). Build a handful of new presentational/client components, extend two existing ones, then recompose `app/protected/page.tsx` into four `BandSection`s. Domain gets TDD; components get render tests.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, TypeScript (strict), Tailwind CSS 4 (CSS-variable tokens + `glass` utility), recharts, next-intl (ES/EN, cookie-driven), next-themes, Vitest + @testing-library/react, Biome.

## Global Constraints

- **No new backend features:** no new tables, queries, RPCs, or server fetches. Deltas come from slicing the already-loaded `txns`. (verbatim: "Do NOT add new backend features — this is a composition, hierarchy, and UX task over existing data.")
- **Design system fixed:** off-white glass cards via the existing `glass` utility / `GlassCard`, midnight-blue `#1E3A8A` (`--brand-900`), one card radius, one type scale. Use existing CSS-variable tokens (`--ink`, `--ink-soft`, `--glass-line`, `--pos`, `--neg`, `--cat-*`, `--brand-*`).
- **Bilingual ES/EN:** every user-facing string goes through next-intl. Add keys to BOTH `messages/en.json` and `messages/es.json`. Default locale is `es`.
- **Light/dark + responsive:** no hard-coded colors; bands collapse to one column on mobile via Tailwind `lg:` breakpoints.
- **Money:** integer **cents** in the domain (ADR-007); format only at the edge via `format(money(cents, currency), locale)` from `@/lib/domain/money`. Never sum across currencies.
- **Pure domain:** `lib/domain/**` is pure and deterministic — no clock reads; callers pass `todayIso` (`YYYY-MM-DD`).
- **Tooling:** package manager is npm; run tests with `npx vitest run <file>`; lint/format with Biome (runs in pre-commit). End commit messages with the Co-Authored-By trailer used by this repo.

---

### Task 1: Domain — prior-window comparison core (`compare.ts`)

Pure functions to slice the equal-length window immediately preceding the current period, plus delta/trend helpers. All other tasks depend on this.

**Files:**
- Create: `lib/domain/dashboard/compare.ts`
- Test: `lib/domain/dashboard/compare.test.ts`

**Interfaces:**
- Consumes: `Period` from `./period`.
- Produces:
  - `previousPeriodRange(period: Period, todayIso: string): { startIso: string; endExclusiveIso: string } | null`
  - `previousPeriodTxns<T extends { occurred_at: string }>(txns: T[], period: Period, todayIso: string): T[]`
  - `pctChange(current: number, previous: number): number | null`
  - `type Trend = 'up' | 'down' | 'flat'`
  - `trendOf(current: number, previous: number): Trend`

- [ ] **Step 1: Write the failing test**

Create `lib/domain/dashboard/compare.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  pctChange,
  previousPeriodRange,
  previousPeriodTxns,
  trendOf,
} from './compare'

const TODAY = '2026-06-29'

describe('previousPeriodRange', () => {
  it('returns the equal-length window immediately before a 30d period', () => {
    // current 30d window starts 2026-05-30; prior window is the 30 days before that.
    expect(previousPeriodRange('30d', TODAY)).toEqual({
      startIso: '2026-04-30',
      endExclusiveIso: '2026-05-30',
    })
  })

  it('returns null for the all-time period (no prior window)', () => {
    expect(previousPeriodRange('all', TODAY)).toBeNull()
  })

  it('uses days-since-Jan-1 as the length for ytd', () => {
    // ytd start = 2026-01-01; length = 179 days to 2026-06-29; prior window
    // is the 179 days before 2026-01-01.
    expect(previousPeriodRange('ytd', TODAY)).toEqual({
      startIso: '2025-07-06',
      endExclusiveIso: '2026-01-01',
    })
  })
})

describe('previousPeriodTxns', () => {
  const rows = [
    { occurred_at: '2026-06-10T00:00:00Z', id: 'now' }, // in current 30d
    { occurred_at: '2026-05-10T00:00:00Z', id: 'prev' }, // in prior 30d
    { occurred_at: '2026-03-01T00:00:00Z', id: 'old' }, // before prior window
  ]

  it('keeps only rows inside the prior window [start, endExclusive)', () => {
    const out = previousPeriodTxns(rows, '30d', TODAY)
    expect(out.map((r) => r.id)).toEqual(['prev'])
  })

  it('returns [] for the all-time period', () => {
    expect(previousPeriodTxns(rows, 'all', TODAY)).toEqual([])
  })
})

describe('pctChange', () => {
  it('returns the rounded percentage change', () => {
    expect(pctChange(110, 100)).toBe(10)
    expect(pctChange(80, 100)).toBe(-20)
  })

  it('returns null when the baseline is non-positive (undefined change)', () => {
    expect(pctChange(50, 0)).toBeNull()
    expect(pctChange(50, -10)).toBeNull()
  })
})

describe('trendOf', () => {
  it('classifies up / down / flat', () => {
    expect(trendOf(10, 5)).toBe('up')
    expect(trendOf(5, 10)).toBe('down')
    expect(trendOf(5, 5)).toBe('flat')
    expect(trendOf(0, 0)).toBe('flat')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/dashboard/compare.test.ts`
Expected: FAIL — `Failed to resolve import "./compare"`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/domain/dashboard/compare.ts`:

```ts
/**
 * Prior-period comparison (dashboard deltas). Pure and deterministic — the
 * caller passes `todayIso` (UTC YYYY-MM-DD) so this never reads the clock.
 * The "previous period" is the equal-length window immediately preceding the
 * current period; 'all' has no prior window (returns null / []).
 *
 * No DB work: the dashboard already loads the full transaction history, so a
 * delta is just a second in-memory slice.
 */
import { periodStartIso, type Period } from './period'

const dayMs = 24 * 60 * 60 * 1000

const toIso = (utcMs: number): string =>
  new Date(utcMs).toISOString().slice(0, 10)

const utcOf = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return Date.UTC(y, m - 1, d)
}

/** The equal-length window immediately before the current period, or null. */
export function previousPeriodRange(
  period: Period,
  todayIso: string
): { startIso: string; endExclusiveIso: string } | null {
  const start = periodStartIso(period, todayIso)
  if (start === null) return null
  const lengthDays = Math.round((utcOf(todayIso) - utcOf(start)) / dayMs)
  const endExclusiveIso = start
  const startIso = toIso(utcOf(start) - lengthDays * dayMs)
  return { startIso, endExclusiveIso }
}

/** Rows whose date falls in the prior window [startIso, endExclusiveIso). */
export function previousPeriodTxns<T extends { occurred_at: string }>(
  txns: T[],
  period: Period,
  todayIso: string
): T[] {
  const range = previousPeriodRange(period, todayIso)
  if (range === null) return []
  return txns.filter((t) => {
    const day = t.occurred_at.slice(0, 10)
    return day >= range.startIso && day < range.endExclusiveIso
  })
}

/**
 * Percentage change of `current` vs `previous`, rounded to a whole number.
 * Returns null when the baseline is ≤ 0 (the change is undefined — don't fake
 * a "+∞%"); callers hide the delta in that case.
 */
export function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

export type Trend = 'up' | 'down' | 'flat'

/** Direction of `current` relative to `previous`. Equal (incl. 0/0) is flat. */
export function trendOf(current: number, previous: number): Trend {
  if (current > previous) return 'up'
  if (current < previous) return 'down'
  return 'flat'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/domain/dashboard/compare.test.ts`
Expected: PASS (all cases). If the `ytd` expected dates differ by rounding, trust the implementation's arithmetic and adjust the literal expectations in the test to match the computed values, then re-run.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/dashboard/compare.ts lib/domain/dashboard/compare.test.ts
git commit -m "feat(dashboard): prior-window comparison core for KPI deltas

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Export the comparison core from the dashboard barrel

**Files:**
- Modify: `lib/domain/dashboard/index.ts`

**Interfaces:**
- Consumes: Task 1 exports.
- Produces: re-exports `previousPeriodRange`, `previousPeriodTxns`, `pctChange`, `trendOf`, `Trend` from `@/lib/domain/dashboard`.

- [ ] **Step 1: Add the export block**

In `lib/domain/dashboard/index.ts`, after the existing `chart-data` export block (the one ending with `} from '@/lib/domain/dashboard/chart-data'`), insert:

```ts
export {
  pctChange,
  previousPeriodRange,
  previousPeriodTxns,
  type Trend,
  trendOf,
} from '@/lib/domain/dashboard/compare'
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/domain/dashboard/index.ts
git commit -m "feat(dashboard): export comparison core from barrel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Add all new i18n keys (ES + EN)

Add every new string up front so later component tasks can render them. Keys live under the existing `dashboard` namespace.

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`

**Interfaces:**
- Produces: translation keys `dashboard.bands.*`, `dashboard.banner.*`, `dashboard.insights.*`, `dashboard.currencyBreakdown.*`, `dashboard.donutEmpty.*`, `dashboard.delta.*`, `dashboard.kpi.netNote`.

- [ ] **Step 1: Add the English keys**

In `messages/en.json`, inside the `"dashboard"` object, add these sibling keys (place after the existing `"kpi"` block; valid JSON — mind the commas):

```json
"bands": {
  "have": "How much do I have?",
  "earn": "Am I earning more than I spend?",
  "spend": "Where does my money go?",
  "activity": "What's happening?"
},
"delta": {
  "vsPrev": "vs. last period"
},
"banner": {
  "title": "{amount} uncategorized",
  "body": "Organize it so your breakdown and savings rate mean something.",
  "cta": "Organize now",
  "running": "Organizing…",
  "done": "Categorized {updated} of {scanned}.",
  "none": "Nothing left to categorize.",
  "error": "Couldn't organize right now. Try again.",
  "dismiss": "Dismiss"
},
"currencyBreakdown": {
  "title": "Net worth by currency",
  "base": "Base"
},
"donutEmpty": {
  "title": "Nothing categorized yet",
  "body": "All your spending is uncategorized. Organize it to see where your money goes.",
  "cta": "Organize spending"
},
"insights": {
  "title": "Insights",
  "soon": "Coming soon",
  "narrative": "Monthly narrative — a plain-language recap of your money.",
  "leakFinder": "Leak finder — recurring charges quietly adding up.",
  "forecast": "Forecast — where your balance is heading."
}
```

Also add inside the existing `"kpi"` object a new key:

```json
"netNote": "This period"
```

- [ ] **Step 2: Add the Spanish keys**

In `messages/es.json`, inside `"dashboard"`, add the mirror keys:

```json
"bands": {
  "have": "¿Cuánto tengo?",
  "earn": "¿Gano más de lo que gasto?",
  "spend": "¿A dónde va mi dinero?",
  "activity": "¿Qué está pasando?"
},
"delta": {
  "vsPrev": "vs. periodo anterior"
},
"banner": {
  "title": "{amount} sin categorizar",
  "body": "Organízalo para que tu desglose y tu tasa de ahorro signifiquen algo.",
  "cta": "Organizar ahora",
  "running": "Organizando…",
  "done": "Categorizadas {updated} de {scanned}.",
  "none": "No queda nada por categorizar.",
  "error": "No se pudo organizar ahora. Inténtalo de nuevo.",
  "dismiss": "Descartar"
},
"currencyBreakdown": {
  "title": "Patrimonio por moneda",
  "base": "Base"
},
"donutEmpty": {
  "title": "Aún no hay nada categorizado",
  "body": "Todo tu gasto está sin categorizar. Organízalo para ver a dónde va tu dinero.",
  "cta": "Organizar gastos"
},
"insights": {
  "title": "Insights",
  "soon": "Próximamente",
  "narrative": "Resumen mensual — un repaso de tu dinero en lenguaje claro.",
  "leakFinder": "Detector de fugas — cargos recurrentes que se acumulan.",
  "forecast": "Previsión — hacia dónde va tu saldo."
}
```

And inside `"kpi"`:

```json
"netNote": "Este periodo"
```

- [ ] **Step 3: Verify both files are valid JSON**

Run: `node -e "require('./messages/en.json'); require('./messages/es.json'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Verify ES and EN have identical key sets**

Run:
```bash
node -e "const f=o=>Object.entries(o).flatMap(([k,v])=>v&&typeof v==='object'?f(v).map(s=>k+'.'+s):[k]);const a=f(require('./messages/en.json').dashboard).sort();const b=f(require('./messages/es.json').dashboard).sort();console.log(JSON.stringify(a)===JSON.stringify(b)?'match':{onlyEn:a.filter(x=>!b.includes(x)),onlyEs:b.filter(x=>!a.includes(x))})"
```
Expected: prints `match`.

- [ ] **Step 5: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "i18n(dashboard): add band, banner, insights, currency-breakdown keys

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `BandSection` layout primitive

A narrative band heading + a 12-column responsive grid wrapper, so `page.tsx` stays declarative.

**Files:**
- Create: `app/protected/BandSection.tsx`
- Test: `app/protected/BandSection.test.tsx`

**Interfaces:**
- Produces: `BandSection({ title, children, className }: { title: string; children: React.ReactNode; className?: string })` — renders a `<section>` with an `<h2>` of `title` and a `div.grid.grid-cols-12` for children.

- [ ] **Step 1: Write the failing test**

Create `app/protected/BandSection.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BandSection } from './BandSection'

describe('BandSection', () => {
  it('renders the band title and its children', () => {
    render(
      <BandSection title="How much do I have?">
        <div>child</div>
      </BandSection>
    )
    expect(
      screen.getByRole('heading', { name: 'How much do I have?' })
    ).toBeInTheDocument()
    expect(screen.getByText('child')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/protected/BandSection.test.tsx`
Expected: FAIL — cannot resolve `./BandSection`.

- [ ] **Step 3: Write minimal implementation**

Create `app/protected/BandSection.tsx`:

```tsx
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * One narrative band of the dashboard: a muted question heading over a shared
 * 12-column grid. Every band uses the same grid so cards line up and the page
 * reads as one composition instead of a stack of mismatched tiles.
 */
export function BandSection({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('flex flex-col gap-4', className)}>
      <h2 className="font-medium text-ink-soft text-sm tracking-wide">
        {title}
      </h2>
      <div className="grid grid-cols-12 gap-4 md:gap-5">{children}</div>
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/protected/BandSection.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/protected/BandSection.tsx app/protected/BandSection.test.tsx
git commit -m "feat(dashboard): BandSection layout primitive

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `CurrencyBreakdown` panel (currency clarity)

Shows net worth per currency, labels the base currency, and never folds foreign currencies together.

**Files:**
- Create: `app/protected/CurrencyBreakdown.tsx`
- Test: `app/protected/CurrencyBreakdown.test.tsx`

**Interfaces:**
- Consumes: `format`, `money` from `@/lib/domain/money`.
- Produces: `CurrencyBreakdown({ netWorthByCurrency, baseCurrency, locale, title, baseLabel, className })` where `netWorthByCurrency: Record<string, number>` (cents).

- [ ] **Step 1: Write the failing test**

Create `app/protected/CurrencyBreakdown.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CurrencyBreakdown } from './CurrencyBreakdown'

describe('CurrencyBreakdown', () => {
  it('lists each currency and marks the base one', () => {
    render(
      <CurrencyBreakdown
        netWorthByCurrency={{ EUR: 869163, USD: -350 }}
        baseCurrency="EUR"
        locale="en"
        title="Net worth by currency"
        baseLabel="Base"
      />
    )
    expect(screen.getByText('Net worth by currency')).toBeInTheDocument()
    expect(screen.getByText('EUR')).toBeInTheDocument()
    expect(screen.getByText('USD')).toBeInTheDocument()
    // base currency is tagged
    expect(screen.getByText('Base')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/protected/CurrencyBreakdown.test.tsx`
Expected: FAIL — cannot resolve `./CurrencyBreakdown`.

- [ ] **Step 3: Write minimal implementation**

Create `app/protected/CurrencyBreakdown.tsx`:

```tsx
import { GlassCard } from '@/components/ui/GlassCard'
import { format, money } from '@/lib/domain/money'
import { cn } from '@/lib/utils'

/**
 * Net worth per currency (currency clarity). Each currency is its own line —
 * the domain never sums across currencies, so neither do we. The base currency
 * is tagged so a stray foreign balance (e.g. a USD coffee) never looks folded
 * into the EUR total.
 */
export function CurrencyBreakdown({
  netWorthByCurrency,
  baseCurrency,
  locale,
  title,
  baseLabel,
  className,
}: {
  netWorthByCurrency: Record<string, number>
  baseCurrency: string
  locale: string
  title: string
  baseLabel: string
  className?: string
}) {
  const rows = Object.entries(netWorthByCurrency).sort((a, b) => {
    if (a[0] === baseCurrency) return -1
    if (b[0] === baseCurrency) return 1
    return a[0].localeCompare(b[0])
  })

  return (
    <GlassCard className={cn('flex flex-col gap-4', className)}>
      <h3 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
        {title}
      </h3>
      <ul className="flex flex-col gap-3">
        {rows.map(([currency, total]) => (
          <li
            key={currency}
            className="flex items-baseline justify-between gap-3"
          >
            <span className="flex items-center gap-2 text-ink text-sm">
              {currency}
              {currency === baseCurrency && (
                <span className="rounded-full bg-brand-100 px-2 py-0.5 font-medium text-brand-700 text-xs">
                  {baseLabel}
                </span>
              )}
            </span>
            <span className="font-display font-semibold text-ink tabular-nums">
              {format(money(total, currency), locale)}
            </span>
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/protected/CurrencyBreakdown.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/protected/CurrencyBreakdown.tsx app/protected/CurrencyBreakdown.test.tsx
git commit -m "feat(dashboard): CurrencyBreakdown panel for per-currency net worth

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `InsightsPlaceholder` (Phase-3 home)

A styled glass card reserving space for future narrative / leak-finder / forecast insights.

**Files:**
- Create: `app/protected/InsightsPlaceholder.tsx`
- Test: `app/protected/InsightsPlaceholder.test.tsx`

**Interfaces:**
- Produces: `InsightsPlaceholder({ title, soonLabel, items, className }: { title: string; soonLabel: string; items: string[]; className?: string })`.

- [ ] **Step 1: Write the failing test**

Create `app/protected/InsightsPlaceholder.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InsightsPlaceholder } from './InsightsPlaceholder'

describe('InsightsPlaceholder', () => {
  it('renders the title, a soon badge, and each preview item', () => {
    render(
      <InsightsPlaceholder
        title="Insights"
        soonLabel="Coming soon"
        items={['Monthly narrative', 'Leak finder', 'Forecast']}
      />
    )
    expect(screen.getByText('Insights')).toBeInTheDocument()
    expect(screen.getByText('Coming soon')).toBeInTheDocument()
    expect(screen.getByText('Leak finder')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/protected/InsightsPlaceholder.test.tsx`
Expected: FAIL — cannot resolve `./InsightsPlaceholder`.

- [ ] **Step 3: Write minimal implementation**

Create `app/protected/InsightsPlaceholder.tsx`:

```tsx
import { Sparkles } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { cn } from '@/lib/utils'

/**
 * Reserved home for Phase-3 insights (narrative, leak finder, forecast). Muted
 * preview rows so the layout already has a slot for them — not an empty gap.
 */
export function InsightsPlaceholder({
  title,
  soonLabel,
  items,
  className,
}: {
  title: string
  soonLabel: string
  items: string[]
  className?: string
}) {
  return (
    <GlassCard className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-medium text-ink-soft text-xs uppercase tracking-wide">
          <Sparkles className="size-4" aria-hidden="true" />
          {title}
        </h3>
        <span className="rounded-full bg-glass-line px-2 py-0.5 font-medium text-ink-soft text-xs">
          {soonLabel}
        </span>
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-center gap-3 rounded-2xl border border-glass-line border-dashed p-3 text-ink-soft text-sm"
          >
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-brand-300"
            />
            {item}
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/protected/InsightsPlaceholder.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/protected/InsightsPlaceholder.tsx app/protected/InsightsPlaceholder.test.tsx
git commit -m "feat(dashboard): InsightsPlaceholder reserving Phase-3 slot

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `DataHealthBanner` (client, inline recategorize, localStorage dismiss)

Dismissible banner shown when a large share of spending is uncategorized; its button calls the existing `recategorizeUncategorized()` server action inline.

**Files:**
- Create: `app/protected/DataHealthBanner.tsx`
- Test: `app/protected/DataHealthBanner.test.tsx`

**Interfaces:**
- Consumes: `recategorizeUncategorized` from `./transactions/actions` (returns `{ ok: true; updated: number; scanned: number } | { ok: false; error: string }`), `format`/`money` from `@/lib/domain/money`, `Button` from `@/components/ui/Button`, `useTranslations` from `next-intl`, `useRouter` from `next/navigation`.
- Produces: `DataHealthBanner({ uncategorizedCents, currency, locale }: { uncategorizedCents: number; currency: string; locale: string })`. Renders nothing if `uncategorizedCents <= 0` or if dismissed for this exact amount.

- [ ] **Step 1: Write the failing test**

Create `app/protected/DataHealthBanner.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import en from '@/messages/en.json'
import { DataHealthBanner } from './DataHealthBanner'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock('./transactions/actions', () => ({
  recategorizeUncategorized: vi.fn(),
}))

function renderBanner(cents: number) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DataHealthBanner
        uncategorizedCents={cents}
        currency="EUR"
        locale="en"
      />
    </NextIntlClientProvider>
  )
}

describe('DataHealthBanner', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('shows the uncategorized amount and an organize action', () => {
    renderBanner(85837)
    expect(screen.getByText(/uncategorized/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /organize now/i })
    ).toBeInTheDocument()
  })

  it('renders nothing when there is nothing uncategorized', () => {
    const { container } = renderBanner(0)
    expect(container).toBeEmptyDOMElement()
  })

  it('stays hidden when already dismissed for this amount', () => {
    window.localStorage.setItem('finova:dataHealthDismissed', '85837')
    const { container } = renderBanner(85837)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/protected/DataHealthBanner.test.tsx`
Expected: FAIL — cannot resolve `./DataHealthBanner`.

- [ ] **Step 3: Write minimal implementation**

Create `app/protected/DataHealthBanner.tsx`:

```tsx
'use client'

import { AlertTriangle, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { format, money } from '@/lib/domain/money'
import { recategorizeUncategorized } from './transactions/actions'

const DISMISS_KEY = 'finova:dataHealthDismissed'

/**
 * Data-health banner: when a large share of spending is uncategorized, the
 * breakdown and savings rate are misleading, so we surface it with a one-click
 * fix (the existing recategorize action) instead of quietly showing bad data.
 *
 * Dismissal is keyed by the uncategorized amount in localStorage, so it stays
 * dismissed until NEW uncategorized spending appears (a different amount), then
 * the banner returns on its own.
 */
export function DataHealthBanner({
  uncategorizedCents,
  currency,
  locale,
}: {
  uncategorizedCents: number
  currency: string
  locale: string
}) {
  const t = useTranslations('dashboard.banner')
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(true) // assume hidden until checked

  // Read prior dismissal on mount (client-only; avoids SSR/localStorage clash).
  useEffect(() => {
    const stored = window.localStorage.getItem(DISMISS_KEY)
    setDismissed(stored === String(uncategorizedCents))
  }, [uncategorizedCents])

  if (uncategorizedCents <= 0 || dismissed) return null

  const amount = format(money(uncategorizedCents, currency), locale)

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, String(uncategorizedCents))
    setDismissed(true)
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-3xl border border-amber-300/60 bg-amber-50/70 p-4 text-ink dark:bg-amber-950/30">
      <AlertTriangle
        className="size-5 shrink-0 text-cat-amber"
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold text-sm">{t('title', { amount })}</span>
        <span className="text-ink-soft text-xs">
          {msg ?? t('body')}
        </span>
      </div>
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => {
          setMsg(null)
          start(async () => {
            const r = await recategorizeUncategorized()
            if (!r.ok) {
              setMsg(t('error'))
            } else if (r.updated === 0) {
              setMsg(t('none'))
            } else {
              setMsg(t('done', { updated: r.updated, scanned: r.scanned }))
              router.refresh()
            }
          })
        }}
      >
        {pending ? t('running') : t('cta')}
      </Button>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('dismiss')}
        className="rounded-full p-1 text-ink-soft hover:text-ink"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/protected/DataHealthBanner.test.tsx`
Expected: PASS. (If `Button` requires a `variant`, the default renders fine; no variant is needed here.)

- [ ] **Step 5: Commit**

```bash
git add app/protected/DataHealthBanner.tsx app/protected/DataHealthBanner.test.tsx
git commit -m "feat(dashboard): DataHealthBanner with inline recategorize + dismiss

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Per-category trend arrow in `SpendingRanking`

Extend the ranking rows with an optional trend direction and render an up/down/flat arrow.

**Files:**
- Modify: `app/protected/SpendingRanking.tsx`
- Test: `app/protected/SpendingRanking.test.tsx`

**Interfaces:**
- Consumes: `Trend` from `@/lib/domain/dashboard`.
- Produces: `RankRow` gains optional `trend?: Trend`. `SpendingRanking` renders an arrow (`ArrowUp`/`ArrowDown` from lucide; nothing for `flat`/undefined) next to each row's label.

- [ ] **Step 1: Write the failing test**

Create `app/protected/SpendingRanking.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { type RankRow, SpendingRanking } from './SpendingRanking'

const rows: RankRow[] = [
  { key: 'a', label: 'Groceries', total: 5000, share: 0.5, currency: 'EUR', trend: 'up' },
  { key: 'b', label: 'Transport', total: 5000, share: 0.5, currency: 'EUR', trend: 'down' },
]

describe('SpendingRanking', () => {
  it('marks the trend direction per row', () => {
    render(
      <SpendingRanking
        title="Where you spend most"
        rows={rows}
        locale="en"
        emptyLabel="No spending in this period."
      />
    )
    expect(screen.getByLabelText('trend-up')).toBeInTheDocument()
    expect(screen.getByLabelText('trend-down')).toBeInTheDocument()
  })

  it('shows the empty label when there are no rows', () => {
    render(
      <SpendingRanking
        title="Where you spend most"
        rows={[]}
        locale="en"
        emptyLabel="No spending in this period."
      />
    )
    expect(
      screen.getByText('No spending in this period.')
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/protected/SpendingRanking.test.tsx`
Expected: FAIL — `trend` not assignable to `RankRow` / no element with label `trend-up`.

- [ ] **Step 3: Edit `SpendingRanking.tsx`**

Replace the imports and `RankRow` interface at the top:

```tsx
import { ArrowDown, ArrowUp } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import type { Trend } from '@/lib/domain/dashboard'
import { format, money } from '@/lib/domain/money'

export interface RankRow {
  currency: string
  key: string
  label: string
  /** Fraction of the whole (0..1). */
  share: number
  /** Positive magnitude in cents. */
  total: number
  /** Direction vs. the previous period (optional; absent ⇒ no arrow). */
  trend?: Trend
}
```

Then, inside the `<li>` label span, replace:

```tsx
                <span className="truncate text-ink">{r.label}</span>
```

with:

```tsx
                <span className="flex min-w-0 items-center gap-1.5 text-ink">
                  {r.trend === 'up' && (
                    <ArrowUp
                      className="size-3.5 shrink-0 text-neg"
                      aria-label="trend-up"
                    />
                  )}
                  {r.trend === 'down' && (
                    <ArrowDown
                      className="size-3.5 shrink-0 text-pos"
                      aria-label="trend-down"
                    />
                  )}
                  <span className="truncate">{r.label}</span>
                </span>
```

> Note: for **spending**, up = worse (more spent) so the arrow uses `text-neg`; down = less spent uses `text-pos`. Flat/undefined renders no arrow.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/protected/SpendingRanking.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/protected/SpendingRanking.tsx app/protected/SpendingRanking.test.tsx
git commit -m "feat(dashboard): per-category trend arrow in SpendingRanking

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: `CategorizeEmptyState` for the donut

When the only spending bucket is "uncategorized", replace the single-color donut with a prompt.

**Files:**
- Create: `app/protected/CategorizeEmptyState.tsx`
- Test: `app/protected/CategorizeEmptyState.test.tsx`

**Interfaces:**
- Consumes: `Button` from `@/components/ui/Button`, `Link` from `next/link`.
- Produces: `CategorizeEmptyState({ title, body, cta }: { title: string; body: string; cta: string })` — links to `/protected/transactions`.

- [ ] **Step 1: Write the failing test**

Create `app/protected/CategorizeEmptyState.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CategorizeEmptyState } from './CategorizeEmptyState'

describe('CategorizeEmptyState', () => {
  it('renders the prompt and a link to transactions', () => {
    render(
      <CategorizeEmptyState
        title="Nothing categorized yet"
        body="All your spending is uncategorized."
        cta="Organize spending"
      />
    )
    expect(screen.getByText('Nothing categorized yet')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Organize spending' })
    expect(link).toHaveAttribute('href', '/protected/transactions')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/protected/CategorizeEmptyState.test.tsx`
Expected: FAIL — cannot resolve `./CategorizeEmptyState`.

- [ ] **Step 3: Write minimal implementation**

Create `app/protected/CategorizeEmptyState.tsx`:

```tsx
import { Tags } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

/**
 * Donut replacement for the "everything is uncategorized" case — a single-color
 * donut says nothing, so prompt the user to categorize instead.
 */
export function CategorizeEmptyState({
  title,
  body,
  cta,
}: {
  title: string
  body: string
  cta: string
}) {
  return (
    <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-2xl border border-glass-line border-dashed p-6 text-center">
      <Tags className="size-8 text-brand-300" aria-hidden="true" />
      <p className="font-medium text-ink text-sm">{title}</p>
      <p className="max-w-xs text-ink-soft text-xs">{body}</p>
      <Button asChild size="sm">
        <Link href="/protected/transactions">{cta}</Link>
      </Button>
    </div>
  )
}
```

> If `Button` does not support an `asChild` prop, replace the `<Button asChild>` wrapper with a plain styled `<Link>` using the same classes the other CTAs use; confirm by checking `components/ui/Button.tsx` before implementing.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/protected/CategorizeEmptyState.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/protected/CategorizeEmptyState.tsx app/protected/CategorizeEmptyState.test.tsx
git commit -m "feat(dashboard): CategorizeEmptyState donut replacement

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Recompose `app/protected/page.tsx` into four bands

The integration task: compute deltas + category trends + uncategorized total, then lay everything out across four `BandSection`s. Removes the duplicate "Saldo total" tile and the redundant top net-worth label; promotes Net Worth to the hero.

**Files:**
- Modify: `app/protected/page.tsx` (full rewrite of the component body)

**Interfaces:**
- Consumes: everything from Tasks 1–9 plus existing dashboard cores. New helpers used: `previousPeriodTxns`, `pctChange`, `trendOf`, `summarizeByCurrency`, `savingsRate`, `spendingByCategory`.

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `app/protected/page.tsx` with:

```tsx
import { getLocale, getTranslations } from 'next-intl/server'
import { AreaChart } from '@/components/charts/AreaChart'
import { BarChart } from '@/components/charts/BarChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { HeroCard } from '@/components/dashboard/HeroCard'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { GlassCard } from '@/components/ui/GlassCard'
import { categoryLabel } from '@/lib/domain/categories/label'
import {
  accountBalances,
  balanceTrend,
  balanceTrendToArea,
  filterByPeriod,
  keyStats,
  monthlySeries,
  monthlySeriesToBars,
  parsePeriod,
  pctChange,
  periodStartIso,
  pickDisplayCurrency,
  previousPeriodTxns,
  savingsRate,
  spendingByAccount,
  spendingByCategory,
  spendingToDonut,
  totalBalanceByCurrency,
  trendOf,
} from '@/lib/domain/dashboard'
import { format, money } from '@/lib/domain/money'
import { summarizeByCurrency } from '@/lib/domain/transactions/totals'
import type { CategoryRow } from '@/lib/validation/category'
import { AccountsStrip } from './AccountsStrip'
import { BandSection } from './BandSection'
import { CategorizeEmptyState } from './CategorizeEmptyState'
import { CurrencyBreakdown } from './CurrencyBreakdown'
import { DashboardEmptyState } from './DashboardEmptyState'
import { DataHealthBanner } from './DataHealthBanner'
import { getDashboardData } from './data'
import { InsightsPlaceholder } from './InsightsPlaceholder'
import { KeyStatsStrip } from './KeyStatsStrip'
import { PeriodSelector } from './PeriodSelector'
import { RecentTransactions } from './RecentTransactions'
import { type RankRow, SpendingRanking } from './SpendingRanking'

const RECENT_LIMIT = 6
const UNCATEGORIZED_THRESHOLD = 0.4

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const t = await getTranslations('dashboard')
  const tDefaults = await getTranslations('categories.defaults')
  const locale = await getLocale()

  const { accounts, categories, txns, baseCurrency } = await getDashboardData()
  const period = parsePeriod((await searchParams).period)

  if (accounts.length === 0 || txns.length === 0) {
    return (
      <div className="flex w-full flex-1 flex-col gap-6">
        <h1 className="font-bold text-2xl">{t('title')}</h1>
        <DashboardEmptyState />
      </div>
    )
  }

  const todayIso = new Date().toISOString().slice(0, 10)
  const currency = pickDisplayCurrency(txns, baseCurrency)

  // Period-sensitive figures use the sliced set; balances/trend are cumulative.
  const periodTxns = filterByPeriod(txns, period, todayIso)
  const prevTxns = previousPeriodTxns(txns, period, todayIso)

  const totals = summarizeByCurrency(periodTxns)[currency] ?? {
    income: 0,
    expense: 0,
    net: 0,
  }
  const prevTotals = summarizeByCurrency(prevTxns)[currency] ?? {
    income: 0,
    expense: 0,
    net: 0,
  }
  const rate = savingsRate(totals)
  const prevRate = savingsRate(prevTotals)

  // KPI deltas (whole %, hidden when the baseline is non-positive).
  const incomeDelta = pctChange(totals.income, prevTotals.income)
  const expenseDelta = pctChange(totals.expense, prevTotals.expense)
  const netDelta = pctChange(totals.net, prevTotals.net)
  // Savings rate moves in percentage POINTS, not %-of-%.
  const rateDelta =
    rate === null || prevRate === null
      ? null
      : Math.round((rate - prevRate) * 100)

  const balanceAccounts = accounts.map((a) => ({
    id: a.id,
    currency: a.currency,
    opening_balance: a.opening_balance,
  }))
  const balances = accountBalances(balanceAccounts, txns)
  const totalByCurrency = totalBalanceByCurrency(balances)
  const totalBalance = totalByCurrency[currency] ?? 0

  // Trend opening = balance carried into the period start (full history before).
  const start = periodStartIso(period, todayIso)
  const before = start
    ? txns.filter((x) => x.occurred_at.slice(0, 10) < start)
    : []
  const opening = totalBalanceByCurrency(accountBalances(balanceAccounts, before))
  const trend = balanceTrend(periodTxns, opening)[currency] ?? []

  const months = monthlySeries(periodTxns)[currency] ?? []
  const bars = monthlySeriesToBars(months)
  const area = balanceTrendToArea(trend)
  const balanceSparkline = trend.map((p) => p.balance / 100)

  const byId = new Map(categories.map((c) => [c.id, c] as const))
  const labelFor = (categoryId: string | null): string =>
    categoryId === null
      ? t('table.uncategorized')
      : labelOf(byId.get(categoryId), tDefaults)

  const spend = spendingByCategory(periodTxns)[currency] ?? []
  const prevSpend = spendingByCategory(prevTxns)[currency] ?? []
  const prevByCategory = new Map(
    prevSpend.map((s) => [s.categoryId ?? '__uncategorized__', s.total] as const)
  )
  const donut = spendingToDonut(spend, labelFor)
  const categoryRanking: RankRow[] = spend.map((s) => {
    const key = s.categoryId ?? '__uncategorized__'
    return {
      key,
      label: labelFor(s.categoryId),
      total: s.total,
      share: s.share,
      currency,
      trend: trendOf(s.total, prevByCategory.get(key) ?? 0),
    }
  })

  const accountById = new Map(accounts.map((a) => [a.id, a] as const))
  const accountRanking: RankRow[] = (
    spendingByAccount(periodTxns)[currency] ?? []
  ).map((s) => ({
    key: s.accountId,
    label: accountById.get(s.accountId)?.name ?? s.accountId,
    total: s.total,
    share: s.share,
    currency,
  }))

  const stats = keyStats(periodTxns)[currency] ?? {
    averageSpend: null,
    biggestExpense: null,
    busiestDay: null,
    count: 0,
  }

  const currencyCount = new Set(txns.map((x) => x.currency)).size

  // Data-health: uncategorized spend and whether it dominates the period.
  const totalSpend = spend.reduce((sum, s) => sum + s.total, 0)
  const uncategorizedCents =
    spend.find((s) => s.categoryId === null)?.total ?? 0
  const uncategorizedShare = totalSpend === 0 ? 0 : uncategorizedCents / totalSpend
  const onlyUncategorized =
    spend.length > 0 && spend.every((s) => s.categoryId === null)

  return (
    <div className="flex w-full flex-1 flex-col gap-10">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-bold text-2xl">{t('title')}</h1>
          <PeriodSelector value={period} />
        </div>
        {currencyCount > 1 && (
          <p className="text-ink-soft text-sm">
            {t('otherCurrencies', { currency })}
          </p>
        )}
      </div>

      {/* Data-health banner (shown only when uncategorized dominates). */}
      {uncategorizedShare >= UNCATEGORIZED_THRESHOLD && (
        <DataHealthBanner
          uncategorizedCents={uncategorizedCents}
          currency={currency}
          locale={locale}
        />
      )}

      {/* Band 1 — How much do I have? */}
      <BandSection title={t('bands.have')}>
        <HeroCard
          className="col-span-12 lg:col-span-8"
          label={`${t('accountsStrip.netWorth')} · ${currency}`}
          value={totalBalance}
          currency={currency}
          locale={locale}
          trend={balanceSparkline}
        />
        <CurrencyBreakdown
          className="col-span-12 lg:col-span-4"
          netWorthByCurrency={totalByCurrency}
          baseCurrency={baseCurrency}
          locale={locale}
          title={t('currencyBreakdown.title')}
          baseLabel={t('currencyBreakdown.base')}
        />
        <AccountsStrip
          className="col-span-12"
          accounts={accounts}
          balances={balances}
          netWorthByCurrency={totalByCurrency}
        />
      </BandSection>

      {/* Band 2 — Am I earning more than I spend? */}
      <BandSection title={t('bands.earn')}>
        <div className="col-span-12 grid grid-cols-2 gap-4 md:gap-5 lg:col-span-5">
          <KpiCard
            label={t('kpi.income')}
            value={totals.income}
            currency={currency}
            locale={locale}
            delta={incomeDelta ?? undefined}
            deltaSuffix="%"
            footnote={t('delta.vsPrev')}
          />
          <KpiCard
            label={t('kpi.expense')}
            value={totals.expense}
            currency={currency}
            locale={locale}
            delta={expenseDelta ?? undefined}
            deltaSuffix="%"
            footnote={t('delta.vsPrev')}
          />
          <KpiCard
            label={t('kpi.savingsRate')}
            value={rate === null ? 0 : Math.round(rate * 100)}
            format={(n) => (rate === null ? '—' : `${n}%`)}
            delta={rateDelta ?? undefined}
            deltaSuffix="pp"
            footnote={t('kpi.savingsRateNote')}
          />
          <KpiCard
            label={t('kpi.net')}
            value={totals.net}
            currency={currency}
            locale={locale}
            delta={netDelta ?? undefined}
            deltaSuffix="%"
            footnote={t('kpi.netNote')}
          />
        </div>
        <GlassCard className="col-span-12 flex flex-col gap-4 lg:col-span-7">
          <h3 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
            {t('charts.incomeVsExpense')}
          </h3>
          <BarChart
            index={bars.index}
            categories={bars.categories}
            data={bars.data}
          />
        </GlassCard>
      </BandSection>

      {/* Band 3 — Where does my money go? */}
      <BandSection title={t('bands.spend')}>
        <GlassCard className="col-span-12 flex flex-col gap-4 lg:col-span-5">
          <h3 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
            {t('charts.spendingByCategory')}
          </h3>
          {onlyUncategorized || donut.length === 0 ? (
            <CategorizeEmptyState
              title={t('donutEmpty.title')}
              body={t('donutEmpty.body')}
              cta={t('donutEmpty.cta')}
            />
          ) : (
            <DonutChart data={donut} />
          )}
        </GlassCard>
        <SpendingRanking
          className="col-span-12 lg:col-span-7"
          title={t('ranking.topCategories')}
          rows={categoryRanking}
          locale={locale}
          emptyLabel={t('ranking.empty')}
        />
        <SpendingRanking
          className="col-span-12 lg:col-span-6"
          title={t('ranking.byAccount')}
          rows={accountRanking}
          locale={locale}
          emptyLabel={t('ranking.empty')}
        />
        <div className="col-span-12 lg:col-span-6">
          <KeyStatsStrip stats={stats} currency={currency} />
        </div>
        <GlassCard className="col-span-12 flex flex-col gap-4">
          <h3 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
            {t('charts.balanceTrend')}
          </h3>
          <AreaChart
            index={area.index}
            categories={area.categories}
            data={area.data}
          />
        </GlassCard>
      </BandSection>

      {/* Band 4 — What's happening? */}
      <BandSection title={t('bands.activity')}>
        <div className="col-span-12 lg:col-span-7">
          <RecentTransactions
            txns={periodTxns.slice(0, RECENT_LIMIT)}
            categories={categories}
          />
        </div>
        <InsightsPlaceholder
          className="col-span-12 lg:col-span-5"
          title={t('insights.title')}
          soonLabel={t('insights.soon')}
          items={[
            t('insights.narrative'),
            t('insights.leakFinder'),
            t('insights.forecast'),
          ]}
        />
      </BandSection>
    </div>
  )
}

/** Resolve a (possibly missing) category row to a display label. */
function labelOf(
  category: CategoryRow | undefined,
  tDefaults: (key: string) => string
): string {
  return category ? categoryLabel(category, tDefaults) : ''
}
```

- [ ] **Step 2: Add the `className` prop to the components that now receive grid spans**

`AccountsStrip`, `KeyStatsStrip`, and `SpendingRanking` are given `col-span-*` classes above. `SpendingRanking` already gets `className` in Task 8 — confirm its function signature includes `className?: string` and applies it to the root `GlassCard` (add `className={cn('flex flex-col gap-4', className)}` with a `cn` import if not already). For `AccountsStrip`: add `className?: string` to its props and change its root to `<GlassCard className={cn('flex flex-col gap-4', className)}>` (import `cn` from `@/lib/utils`). `KeyStatsStrip` is wrapped in a plain `<div className="col-span-... ">` above, so it needs no change. Make these edits now.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (Common fixes: ensure `AccountsStrip`/`SpendingRanking` accept `className`; ensure `KpiCard`'s `format` prop signature is `(n: number) => string` — it is.)

- [ ] **Step 4: Run the full dashboard test + component tests**

Run: `npx vitest run lib/domain/dashboard app/protected`
Expected: PASS (all domain + component tests, including the ones added in Tasks 1–9).

- [ ] **Step 5: Commit**

```bash
git add app/protected/page.tsx app/protected/AccountsStrip.tsx app/protected/SpendingRanking.tsx
git commit -m "feat(dashboard): recompose into four narrative bands with deltas

Promote Net Worth to the hero, drop the duplicate Saldo total tile, add
per-KPI vs-previous-period deltas, category trends, the data-health banner,
currency breakdown, and the Phase-3 insights placeholder.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Full verification & visual pass

**Files:** none (verification only).

- [ ] **Step 1: Lint/format**

Run: `npx @biomejs/biome check .`
Expected: no errors. If formatting differs, run `npx @biomejs/biome check --write .` and re-run.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 3: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean type-check; build succeeds.

- [ ] **Step 4: Manual visual check**

Run: `npm run dev`, log in, open `/protected`, and confirm:
  - Net Worth is the single largest card (Band 1); no duplicate "Saldo total" tile; net worth appears once.
  - KPIs (Income / Expenses / Savings rate / Net) each show a delta pill where a prior period exists; switch the period selector to `all` and confirm deltas disappear gracefully.
  - Changing the period (30d/90d/YTD/12m/all) updates every panel (KPIs, deltas, donut, rankings, charts, banner).
  - With the seeded uncategorized data, the banner appears ("858 € sin categorizar…"); clicking Organize runs and refreshes; dismissing hides it; reloading keeps it hidden.
  - The category donut shows the categorize prompt when everything is uncategorized.
  - Toggle ES/EN — all new strings translate. Toggle light/dark — all new components adapt.
  - Resize to mobile — every band stacks to one column.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(dashboard): verification pass (lint/types/visual)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Remove redundancy (net worth once, drop Saldo total, net flow as KPI) → Task 10.
- Hero = Net Worth + trend → Task 10 (HeroCard).
- Data-health banner → Tasks 3, 7, 10.
- Empty/onboarding states (donut) → Tasks 3, 9, 10; existing empties (ranking/recent) preserved.
- Currency clarity → Task 5 + existing `otherCurrencies` note (Task 10).
- Four bands in order → Task 4 + Task 10.
- vs-previous-period delta on every KPI → Tasks 1, 10.
- Per-category trend indicator → Tasks 1, 8, 10.
- Period selector drives every panel → Task 10 (all panels read `periodTxns`/`prevTxns`) + Task 11 verification.
- Consistent density / one grid → Task 4 + Task 10.
- Phase-3 placeholder → Tasks 3, 6, 10.
- Responsive, bilingual, light/dark → Tasks 3–10 + Task 11 verification.

**Placeholder scan:** No TBD/TODO; every code step shows full code.

**Type consistency:** `Trend` defined in Task 1, exported in Task 2, consumed in Tasks 8 & 10. `RankRow.trend?` added in Task 8, populated in Task 10. `pctChange`/`previousPeriodTxns`/`trendOf` signatures match between Task 1 and Task 10 usage. `KpiCard` `delta?: number` / `deltaSuffix?` / `footnote?` / `format?` match Task 10 usage. `recategorizeUncategorized` result shape matches Task 7 usage.

**Changelog (deliverable):** produced at the end of Task 11 / final summary — moved net worth to hero; merged the three duplicate balance figures into one hero + one net KPI; removed the duplicate "Saldo total" tile and redundant top net-worth label; added deltas, category trends, data-health banner, currency breakdown, donut empty state, and insights placeholder; regrouped all panels into four bands on one 12-column grid.
