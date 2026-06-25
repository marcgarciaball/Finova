# Finova Component Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Finova design tokens into the Tailwind v4 project and build the reusable primitive + chart component foundation, viewable on a `/design` showcase route.

**Architecture:** Three component layers (`components/ui/` primitives, `components/dashboard/` composites, `components/charts/` Recharts wrappers) built on a token layer in `app/globals.css`. All components follow the existing CVA + `cn` convention, ship light + dark, and gate motion behind `motion-safe`.

**Tech Stack:** Next.js 16, React 19, Tailwind v4 (CSS-first `@theme`), class-variance-authority, clsx + tailwind-merge (`cn`), lucide-react, next-themes, recharts, Vitest + Testing Library + jsdom.

## Global Constraints

- **Tailwind v4 only** — CSS-first config in `app/globals.css` via `@theme`/`@utility`. No `tailwind.config.ts`.
- **Design system is authoritative** — token values copied verbatim from `CLAUDE.md` §2/§3. No ad-hoc hex anywhere; use token classes (`bg-brand`, `text-ink`, `text-pos`, `fill-cat-teal`, …).
- **Convention** — components use `React.forwardRef`, `cva` for variants, `cn(...)` from `@/lib/utils`, named exports. Import alias `@/` → repo root.
- **Money** — always `tabular-nums`; income → `pos`; deltas → `pos`/`neg` pills with **sign + icon** (never color alone).
- **Motion** — every transition/animation wrapped in `motion-safe:` (or disabled under `prefers-reduced-motion`).
- **A11y** — visible `ring-brand-500` focus, accessible names on icon-only controls, semantic HTML, 40px min tap targets, WCAG AA contrast on glass.
- **Test runner** — `npm run test` (vitest, globals enabled, jsdom). Lint/format: `npm run lint` / `npm run format`. Types: `npm run typecheck`.
- **Commits** — agent stages; the pre-commit hook/human completes the commit (sandbox blocks git writes). Run the `git add`/`git commit` step regardless; if it doesn't land, leave changes staged.

---

### Task 1: Token foundation in globals.css + fonts

CSS tokens can't be meaningfully unit-tested in jsdom (no CSS engine), so this task verifies via typecheck + a dev-server boot rather than vitest.

**Files:**
- Modify: `app/globals.css` (full rewrite of token blocks)
- Modify: `app/layout.tsx` (fonts)

**Interfaces:**
- Produces: Tailwind color utilities `brand-50|100|300|500|600|700|900|950` (+ `brand` DEFAULT = brand-900), `cat-blue|teal|violet|amber|rose|lime`, `pos`, `pos-soft`, `neg`, `neg-soft`, `ink`, `ink-2`, `ink-soft`, `glass`, `glass-line`; radii `rounded-xl|2xl|3xl|4xl`; `shadow-soft`, `shadow-glass`; `backdrop-blur-glass`; font families `font-sans|display|mono`; a `glass` utility class. Back-compat aliases keep `bg-primary`, `bg-background`, `border-border`, `ring-ring`, `bg-card`, `text-muted-foreground`, etc. working.

- [ ] **Step 1: Rewrite `app/globals.css`**

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  /* Brand */
  --brand-50:#EEF2FC; --brand-100:#E5ECFB; --brand-300:#93AEEE;
  --brand-500:#4B73DD; --brand-600:#3358C9; --brand-700:#2647A8;
  --brand-900:#1E3A8A; --brand-950:#13235C;
  /* Categorical */
  --cat-blue:#2563EB; --cat-teal:#0E9CA6; --cat-violet:#7C5CFF;
  --cat-amber:#E8A33D; --cat-rose:#E8588E; --cat-lime:#5BB85B;
  /* Semantic */
  --pos:#1FA971; --pos-soft:#DBF1E6; --neg:#E0464B; --neg-soft:#FBE2E3;
  /* Background stops */
  --bg-a:#EEF1F8; --bg-b:#F6F4EF;
  /* Ink */
  --ink:#16203A; --ink-2:#33405E; --ink-soft:#7C849A;
  /* Glass */
  --glass:rgba(255,255,255,.55); --glass-line:rgba(255,255,255,.65);
  --radius:0.875rem;

  /* Back-compat aliases (shadcn token names used by existing auth UI) */
  --background:var(--bg-a);
  --foreground:var(--ink);
  --card:var(--glass);
  --card-foreground:var(--ink);
  --popover:#FFFFFF;
  --popover-foreground:var(--ink);
  --primary:var(--brand-900);
  --primary-foreground:#FFFFFF;
  --secondary:var(--brand-50);
  --secondary-foreground:var(--brand-900);
  --muted:var(--brand-50);
  --muted-foreground:var(--ink-soft);
  --accent:var(--brand-100);
  --accent-foreground:var(--brand-900);
  --destructive:var(--neg);
  --destructive-foreground:#FFFFFF;
  --border:var(--glass-line);
  --input:var(--glass-line);
  --ring:var(--brand-500);
}

.dark {
  --brand-50:#161E36; --brand-100:#1B2542; --brand-300:#9DB4F0;
  --brand-500:#7E9CEC; --brand-600:#5A7DE0; --brand-700:#3358C9;
  --brand-900:#5A7DE0; --brand-950:#9DB4F0;
  --cat-blue:#5B8DEF; --cat-teal:#3FB7C0; --cat-violet:#9A82FF;
  --cat-amber:#EDB463; --cat-rose:#EF7CA6; --cat-lime:#7BCB7B;
  --pos:#34D399; --pos-soft:#13301F; --neg:#FF6166; --neg-soft:#321719;
  --bg-a:#0B1020; --bg-b:#0E1224;
  --ink:#EAEEF8; --ink-2:#C3CADC; --ink-soft:#828AA1;
  --glass:rgba(34,42,68,.55); --glass-line:rgba(255,255,255,.08);

  --background:var(--bg-a);
  --foreground:var(--ink);
  --card:var(--glass);
  --card-foreground:var(--ink);
  --popover:#161E36;
  --popover-foreground:var(--ink);
  --primary:var(--brand-900);
  --primary-foreground:#0B1020;
  --secondary:var(--brand-50);
  --secondary-foreground:var(--ink);
  --muted:var(--brand-50);
  --muted-foreground:var(--ink-soft);
  --accent:var(--brand-100);
  --accent-foreground:var(--ink);
  --destructive:var(--neg);
  --destructive-foreground:#0B1020;
  --border:var(--glass-line);
  --input:var(--glass-line);
  --ring:var(--brand-500);
}

@theme inline {
  --color-brand-50:var(--brand-50);
  --color-brand-100:var(--brand-100);
  --color-brand-300:var(--brand-300);
  --color-brand-500:var(--brand-500);
  --color-brand-600:var(--brand-600);
  --color-brand-700:var(--brand-700);
  --color-brand-900:var(--brand-900);
  --color-brand-950:var(--brand-950);
  --color-brand:var(--brand-900);

  --color-cat-blue:var(--cat-blue);
  --color-cat-teal:var(--cat-teal);
  --color-cat-violet:var(--cat-violet);
  --color-cat-amber:var(--cat-amber);
  --color-cat-rose:var(--cat-rose);
  --color-cat-lime:var(--cat-lime);

  --color-pos:var(--pos);
  --color-pos-soft:var(--pos-soft);
  --color-neg:var(--neg);
  --color-neg-soft:var(--neg-soft);

  --color-ink:var(--ink);
  --color-ink-2:var(--ink-2);
  --color-ink-soft:var(--ink-soft);

  --color-glass:var(--glass);
  --color-glass-line:var(--glass-line);

  /* back-compat */
  --color-background:var(--background);
  --color-foreground:var(--foreground);
  --color-card:var(--card);
  --color-card-foreground:var(--card-foreground);
  --color-popover:var(--popover);
  --color-popover-foreground:var(--popover-foreground);
  --color-primary:var(--primary);
  --color-primary-foreground:var(--primary-foreground);
  --color-secondary:var(--secondary);
  --color-secondary-foreground:var(--secondary-foreground);
  --color-muted:var(--muted);
  --color-muted-foreground:var(--muted-foreground);
  --color-accent:var(--accent);
  --color-accent-foreground:var(--accent-foreground);
  --color-destructive:var(--destructive);
  --color-destructive-foreground:var(--destructive-foreground);
  --color-border:var(--border);
  --color-input:var(--input);
  --color-ring:var(--ring);

  --radius-xl:14px;
  --radius-2xl:18px;
  --radius-3xl:22px;
  --radius-4xl:26px;
  --radius-lg:var(--radius);
  --radius-md:calc(var(--radius) - 2px);
  --radius-sm:calc(var(--radius) - 4px);

  --shadow-soft:0 1px 1px rgba(30,58,138,.05), 0 4px 14px -8px rgba(30,58,138,.18);
  --shadow-glass:0 1px 1px rgba(30,58,138,.05), 0 18px 40px -18px rgba(30,58,138,.28);

  --blur-glass:22px;

  --font-sans:var(--font-inter), -apple-system, system-ui, sans-serif;
  --font-display:var(--font-inter-tight), var(--font-inter), sans-serif;
  --font-mono:var(--font-jetbrains), ui-monospace, monospace;
}

@utility glass {
  background-color:var(--glass);
  backdrop-filter:blur(var(--blur-glass));
  border:1px solid var(--glass-line);
  border-radius:var(--radius-3xl);
  box-shadow:var(--shadow-glass);
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    color:var(--ink);
    background:
      radial-gradient(900px 600px at 12% -5%, var(--brand-100), transparent 55%),
      radial-gradient(800px 500px at 95% 0%, color-mix(in srgb, var(--cat-teal) 18%, transparent), transparent 55%),
      linear-gradient(135deg, var(--bg-a), var(--bg-b));
    background-attachment:fixed;
    min-height:100vh;
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration:0.01ms !important;
    animation-iteration-count:1 !important;
    transition-duration:0.01ms !important;
    scroll-behavior:auto !important;
  }
}
```

- [ ] **Step 2: Wire fonts in `app/layout.tsx`**

Replace the `Geist` import and usage:

```tsx
import { Inter, Inter_Tight, JetBrains_Mono } from 'next/font/google'

const inter = Inter({ variable: '--font-inter', display: 'swap', subsets: ['latin'] })
const interTight = Inter_Tight({ variable: '--font-inter-tight', display: 'swap', subsets: ['latin'] })
const jetbrains = JetBrains_Mono({ variable: '--font-jetbrains', display: 'swap', subsets: ['latin'] })
```

Then update the `<body>` className:

```tsx
<body className={`${inter.variable} ${interTight.variable} ${jetbrains.variable} font-sans antialiased`}>
```

- [ ] **Step 3: Verify typecheck + lint pass**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0 (no type errors; biome clean).

- [ ] **Step 4: Verify dev server boots and a page renders**

Run: `npm run build` (compiles CSS + pages)
Expected: build completes without CSS/parse errors. Existing `/` and `/protected` pages still compile.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "feat(design): wire Finova tokens + fonts into Tailwind v4"
```

---

### Task 2: Button — add brand/glass variants

**Files:**
- Modify: `components/ui/button.tsx`
- Test: `components/ui/button.test.tsx`

**Interfaces:**
- Consumes: tokens from Task 1.
- Produces: `Button` with `variant` ∈ `brand | glass | ghost | outline | destructive | link | default` and `size` ∈ `default | sm | lg | icon`. `buttonVariants` export unchanged in signature.

- [ ] **Step 1: Write the failing test**

```tsx
// components/ui/button.test.tsx
import { render, screen } from '@testing-library/react'
import { Button } from './button'

test('brand variant applies brand background and is min 40px tall', () => {
  render(<Button variant="brand">Save</Button>)
  const btn = screen.getByRole('button', { name: 'Save' })
  expect(btn.className).toContain('bg-brand')
  expect(btn.className).toContain('h-11')
})

test('glass variant applies glass border', () => {
  render(<Button variant="glass">Filter</Button>)
  expect(screen.getByRole('button', { name: 'Filter' }).className).toContain('border-glass-line')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- button`
Expected: FAIL (`bg-brand`/`h-11` not present).

- [ ] **Step 3: Update `buttonVariants`**

Set the base ring to brand and add variants/sizes. Replace the `variants` block:

```tsx
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-medium text-sm transition-colors motion-safe:transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-brand text-white shadow-soft hover:bg-brand-700',
        brand: 'bg-brand text-white shadow-soft hover:bg-brand-700',
        glass: 'glass text-ink hover:-translate-y-0.5',
        outline: 'border border-glass-line bg-glass text-ink hover:bg-brand-50',
        ghost: 'text-ink hover:bg-brand-50',
        destructive: 'bg-neg text-white shadow-soft hover:opacity-90',
        link: 'text-brand-600 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-5 py-2',
        sm: 'h-10 rounded-xl px-3 text-xs',
        lg: 'h-12 rounded-2xl px-8',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- button`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/ui/button.tsx components/ui/button.test.tsx
git commit -m "feat(ui): add brand/glass button variants on Finova tokens"
```

---

### Task 3: GlassCard

**Files:**
- Create: `components/ui/glass-card.tsx`
- Test: `components/ui/glass-card.test.tsx`

**Interfaces:**
- Produces: `GlassCard` (forwardRef `div`) — glass surface, optional `hoverable` prop adding motion-safe lift. Re-exports `CardHeader/Title/Description/Content/Footer` from `./card` for composition.

- [ ] **Step 1: Write the failing test**

```tsx
// components/ui/glass-card.test.tsx
import { render, screen } from '@testing-library/react'
import { GlassCard } from './glass-card'

test('renders a glass surface', () => {
  render(<GlassCard data-testid="gc">Hi</GlassCard>)
  expect(screen.getByTestId('gc').className).toContain('glass')
})

test('hoverable adds motion-safe lift', () => {
  render(<GlassCard hoverable data-testid="gc">Hi</GlassCard>)
  expect(screen.getByTestId('gc').className).toContain('motion-safe:hover:-translate-y-0.5')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- glass-card`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```tsx
// components/ui/glass-card.tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hoverable = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'glass p-6 text-ink',
        hoverable &&
          'motion-safe:transition motion-safe:duration-300 motion-safe:ease-out motion-safe:hover:-translate-y-0.5',
        className
      )}
      {...props}
    />
  )
)
GlassCard.displayName = 'GlassCard'

export { GlassCard }
export {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- glass-card`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/ui/glass-card.tsx components/ui/glass-card.test.tsx
git commit -m "feat(ui): add GlassCard surface primitive"
```

---

### Task 4: Input — glass styling

**Files:**
- Modify: `components/ui/input.tsx`
- Test: `components/ui/input.test.tsx`

**Interfaces:**
- Produces: `Input` with glass fill, `rounded-2xl`, brand focus ring.

- [ ] **Step 1: Write the failing test**

```tsx
// components/ui/input.test.tsx
import { render, screen } from '@testing-library/react'
import { Input } from './input'

test('input has glass fill and brand focus ring', () => {
  render(<Input aria-label="amount" />)
  const el = screen.getByLabelText('amount')
  expect(el.className).toContain('bg-glass')
  expect(el.className).toContain('focus-visible:ring-brand-500')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- "ui/input"`
Expected: FAIL.

- [ ] **Step 3: Implement** — replace the input `className` with:

```tsx
className={cn(
  'flex h-11 w-full rounded-2xl border border-glass-line bg-glass px-4 py-2 text-sm text-ink shadow-soft placeholder:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50',
  className
)}
```

(Keep the existing forwardRef/type/props structure; only the className string changes.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- "ui/input"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ui/input.tsx components/ui/input.test.tsx
git commit -m "feat(ui): glass-style Input on Finova tokens"
```

---

### Task 5: DeltaPill

**Files:**
- Create: `components/ui/delta-pill.tsx`
- Test: `components/ui/delta-pill.test.tsx`

**Interfaces:**
- Produces: `DeltaPill` — props `{ value: number; suffix?: string; className?: string }`. Positive → `pos`/`pos-soft` + ArrowUp + `+`; negative → `neg`/`neg-soft` + ArrowDown + `−`. Uses `tabular-nums`. Icon is `aria-hidden`; sign carries meaning textually.

- [ ] **Step 1: Write the failing test**

```tsx
// components/ui/delta-pill.test.tsx
import { render, screen } from '@testing-library/react'
import { DeltaPill } from './delta-pill'

test('positive delta shows + sign and pos tokens', () => {
  render(<DeltaPill value={2.6} suffix="%" />)
  const el = screen.getByText(/\+2\.6%/)
  expect(el.closest('span')?.className).toContain('text-pos')
})

test('negative delta shows minus sign and neg tokens', () => {
  render(<DeltaPill value={-1.2} suffix="%" />)
  const el = screen.getByText(/−1\.2%/)
  expect(el.closest('span')?.className).toContain('text-neg')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- delta-pill`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```tsx
// components/ui/delta-pill.tsx
import { ArrowDown, ArrowUp } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface DeltaPillProps {
  value: number
  suffix?: string
  className?: string
}

export function DeltaPill({ value, suffix = '', className }: DeltaPillProps) {
  const positive = value >= 0
  const Icon = positive ? ArrowUp : ArrowDown
  const sign = positive ? '+' : '−'
  const magnitude = Math.abs(value)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs tabular-nums',
        positive ? 'bg-pos-soft text-pos' : 'bg-neg-soft text-neg',
        className
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {`${sign}${magnitude}${suffix}`}
    </span>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- delta-pill`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/ui/delta-pill.tsx components/ui/delta-pill.test.tsx
git commit -m "feat(ui): add DeltaPill (sign + icon, never color-only)"
```

---

### Task 6: Stat (count-up number, reduced-motion aware)

**Files:**
- Create: `components/ui/stat.tsx`
- Test: `components/ui/stat.test.tsx`

**Interfaces:**
- Produces: `Stat` — props `{ value: number; format?: (n: number) => string; className?: string }`. Renders final formatted value immediately on mount (content never hidden); animates from 0 → value only under `motion-safe` via `requestAnimationFrame`. Default format: `value.toLocaleString()`.

- [ ] **Step 1: Write the failing test**

```tsx
// components/ui/stat.test.tsx
import { render, screen } from '@testing-library/react'
import { Stat } from './stat'

test('renders formatted final value immediately', () => {
  render(<Stat value={2420.1} format={(n) => `$${n.toFixed(2)}`} />)
  expect(screen.getByText('$2420.10')).toBeInTheDocument()
})

test('applies display font and tabular-nums', () => {
  render(<Stat value={100} data-testid="stat" />)
  expect(screen.getByText('100').className).toContain('tabular-nums')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- "ui/stat"`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```tsx
// components/ui/stat.tsx
'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface StatProps {
  value: number
  format?: (n: number) => string
  className?: string
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

export function Stat({ value, format = (n) => n.toLocaleString(), className }: StatProps) {
  const [display, setDisplay] = React.useState(value)

  React.useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value)
      return
    }
    let raf = 0
    const duration = 600
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setDisplay(value * (1 - (1 - t) ** 3))
      if (t < 1) raf = requestAnimationFrame(tick)
      else setDisplay(value)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return (
    <span
      className={cn(
        'font-display font-bold text-4xl text-ink tracking-tight tabular-nums',
        className
      )}
    >
      {format(display)}
    </span>
  )
}
```

Note: the test renders in jsdom where `matchMedia` is defined by `vitest.setup.ts` if mocked; if not present, `prefersReducedMotion()` returns false and the rAF path runs, but the initial state is already `value`, so the immediate-render assertion passes either way.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- "ui/stat"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/ui/stat.tsx components/ui/stat.test.tsx
git commit -m "feat(ui): add Stat count-up number (reduced-motion safe)"
```

---

### Task 7: SegmentedControl

**Files:**
- Create: `components/ui/segmented-control.tsx`
- Test: `components/ui/segmented-control.test.tsx`

**Interfaces:**
- Produces: `SegmentedControl` — props `{ options: { label: string; value: string }[]; value: string; onValueChange: (v: string) => void; 'aria-label': string; className?: string }`. `role="radiogroup"`; each item is a `role="radio"` button with `aria-checked`; active item gets lighter glass + `shadow-soft`.

- [ ] **Step 1: Write the failing test**

```tsx
// components/ui/segmented-control.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SegmentedControl } from './segmented-control'

const opts = [
  { label: 'Day', value: 'd' },
  { label: 'Week', value: 'w' },
]

test('marks the active option as checked', () => {
  render(<SegmentedControl aria-label="range" options={opts} value="d" onValueChange={() => {}} />)
  expect(screen.getByRole('radio', { name: 'Day' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('radio', { name: 'Week' })).toHaveAttribute('aria-checked', 'false')
})

test('calls onValueChange when an option is clicked', async () => {
  const onChange = vi.fn()
  render(<SegmentedControl aria-label="range" options={opts} value="d" onValueChange={onChange} />)
  await userEvent.click(screen.getByRole('radio', { name: 'Week' }))
  expect(onChange).toHaveBeenCalledWith('w')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- segmented-control`
Expected: FAIL (module not found). Note: if `@testing-library/user-event` is not installed, install it first: `npm i -D @testing-library/user-event` and re-run.

- [ ] **Step 3: Implement**

```tsx
// components/ui/segmented-control.tsx
'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedOption {
  label: string
  value: string
}

export interface SegmentedControlProps {
  options: SegmentedOption[]
  value: string
  onValueChange: (value: string) => void
  'aria-label': string
  className?: string
}

export function SegmentedControl({
  options,
  value,
  onValueChange,
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('glass inline-flex gap-1 rounded-full p-1', className)}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              'rounded-full px-4 py-1.5 font-medium text-sm transition-colors motion-safe:transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              active
                ? 'bg-glass text-ink shadow-soft'
                : 'text-ink-soft hover:text-ink'
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- segmented-control`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/ui/segmented-control.tsx components/ui/segmented-control.test.tsx package.json package-lock.json
git commit -m "feat(ui): add accessible SegmentedControl"
```

---

### Task 8: KpiCard

**Files:**
- Create: `components/dashboard/kpi-card.tsx`
- Test: `components/dashboard/kpi-card.test.tsx`

**Interfaces:**
- Consumes: `GlassCard` (Task 3), `Stat` (Task 6), `DeltaPill` (Task 5).
- Produces: `KpiCard` — props `{ label: string; value: number; format?: (n: number) => string; delta?: number; deltaSuffix?: string; footnote?: string; className?: string }`.

- [ ] **Step 1: Write the failing test**

```tsx
// components/dashboard/kpi-card.test.tsx
import { render, screen } from '@testing-library/react'
import { KpiCard } from './kpi-card'

test('renders label, value, delta and footnote', () => {
  render(
    <KpiCard
      label="Spending"
      value={1232}
      format={(n) => `$${Math.round(n)}`}
      delta={3.4}
      deltaSuffix="%"
      footnote="vs last 30 days"
    />
  )
  expect(screen.getByText('Spending')).toBeInTheDocument()
  expect(screen.getByText('$1232')).toBeInTheDocument()
  expect(screen.getByText(/\+3\.4%/)).toBeInTheDocument()
  expect(screen.getByText('vs last 30 days')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- kpi-card`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```tsx
// components/dashboard/kpi-card.tsx
import { DeltaPill } from '@/components/ui/delta-pill'
import { GlassCard } from '@/components/ui/glass-card'
import { Stat } from '@/components/ui/stat'
import { cn } from '@/lib/utils'

export interface KpiCardProps {
  label: string
  value: number
  format?: (n: number) => string
  delta?: number
  deltaSuffix?: string
  footnote?: string
  className?: string
}

export function KpiCard({
  label,
  value,
  format,
  delta,
  deltaSuffix,
  footnote,
  className,
}: KpiCardProps) {
  return (
    <GlassCard hoverable className={cn('flex flex-col gap-2', className)}>
      <span className="font-medium text-ink-soft text-xs uppercase tracking-wide">
        {label}
      </span>
      <div className="flex items-end justify-between gap-3">
        <Stat value={value} format={format} />
        {delta !== undefined && <DeltaPill value={delta} suffix={deltaSuffix} />}
      </div>
      {footnote && <span className="text-ink-soft text-xs">{footnote}</span>}
    </GlassCard>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- kpi-card`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/kpi-card.tsx components/dashboard/kpi-card.test.tsx
git commit -m "feat(dashboard): add KpiCard composite"
```

---

### Task 9: Charts — install Recharts + Sparkline/AreaChart

**Files:**
- Modify: `package.json` (add `recharts`)
- Create: `components/charts/chart-theme.ts`
- Create: `components/charts/area-chart.tsx`
- Test: `components/charts/area-chart.test.tsx`

**Interfaces:**
- Produces: `CAT_SERIES: string[]` (ordered token CSS-var refs `var(--cat-blue)` … `var(--cat-lime)`) and `BRAND_LINE = 'var(--brand-600)'` from `chart-theme.ts`. `AreaChart` — props `{ data: Record<string, number | string>[]; index: string; categories: string[]; className?: string }`. Single category → brand line + gradient fill; multiple → `CAT_SERIES` in order. `Sparkline` — props `{ data: number[]; className?: string }`, compact single-series area, no axes.

- [ ] **Step 1: Install Recharts**

Run: `npm i recharts@2`
Expected: adds `recharts` to dependencies.

- [ ] **Step 2: Write the failing test**

```tsx
// components/charts/area-chart.test.tsx
import { render } from '@testing-library/react'
import { AreaChart, Sparkline } from './area-chart'

// Recharts ResponsiveContainer needs a sized parent in jsdom; smoke-test only.
test('AreaChart renders without crashing', () => {
  const data = [
    { month: 'Jan', net: 10 },
    { month: 'Feb', net: 14 },
  ]
  const { container } = render(
    <div style={{ width: 400, height: 200 }}>
      <AreaChart data={data} index="month" categories={['net']} />
    </div>
  )
  expect(container).toBeTruthy()
})

test('Sparkline renders without crashing', () => {
  const { container } = render(
    <div style={{ width: 200, height: 48 }}>
      <Sparkline data={[1, 3, 2, 5, 4]} />
    </div>
  )
  expect(container).toBeTruthy()
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -- "charts/area-chart"`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement chart theme**

```ts
// components/charts/chart-theme.ts
export const CAT_SERIES = [
  'var(--cat-blue)',
  'var(--cat-teal)',
  'var(--cat-violet)',
  'var(--cat-amber)',
  'var(--cat-rose)',
  'var(--cat-lime)',
]

export const BRAND_LINE = 'var(--brand-600)'

export function seriesColor(i: number) {
  return CAT_SERIES[i % CAT_SERIES.length]
}
```

- [ ] **Step 5: Implement AreaChart + Sparkline**

```tsx
// components/charts/area-chart.tsx
'use client'
import {
  Area,
  CartesianGrid,
  AreaChart as ReAreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import { BRAND_LINE, seriesColor } from './chart-theme'

export interface AreaChartProps {
  data: Record<string, number | string>[]
  index: string
  categories: string[]
  className?: string
}

export function AreaChart({ data, index, categories, className }: AreaChartProps) {
  const single = categories.length === 1
  return (
    <div className={cn('h-64 w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <ReAreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {categories.map((c, i) => {
              const color = single ? BRAND_LINE : seriesColor(i)
              return (
                <linearGradient key={c} id={`fill-${c}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              )
            })}
          </defs>
          <CartesianGrid stroke="var(--ink-soft)" strokeOpacity={0.12} vertical={false} />
          <XAxis
            dataKey={index}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 14,
              border: '1px solid var(--glass-line)',
              background: 'var(--glass)',
              backdropFilter: 'blur(22px)',
              color: 'var(--ink)',
            }}
          />
          {categories.map((c, i) => {
            const color = single ? BRAND_LINE : seriesColor(i)
            return (
              <Area
                key={c}
                type="monotone"
                dataKey={c}
                stroke={color}
                strokeWidth={2}
                fill={`url(#fill-${c})`}
                isAnimationActive={false}
              />
            )
          })}
        </ReAreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export interface SparklineProps {
  data: number[]
  className?: string
}

export function Sparkline({ data, className }: SparklineProps) {
  const points = data.map((value, i) => ({ i, value }))
  return (
    <div className={cn('h-12 w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <ReAreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke="currentColor"
            strokeWidth={2}
            fill="url(#spark-fill)"
            isAnimationActive={false}
          />
        </ReAreaChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test -- "charts/area-chart"`
Expected: PASS (2 smoke tests). If Recharts logs width/height warnings, that is acceptable for the smoke test.

- [ ] **Step 7: Commit**

```bash
git add components/charts/ package.json package-lock.json
git commit -m "feat(charts): add Recharts AreaChart + Sparkline on Finova palette"
```

---

### Task 10: Charts — BarChart + DonutChart

**Files:**
- Create: `components/charts/bar-chart.tsx`
- Create: `components/charts/donut-chart.tsx`
- Test: `components/charts/bar-donut.test.tsx`

**Interfaces:**
- Consumes: `seriesColor`, `BRAND_LINE` from `chart-theme.ts`.
- Produces: `BarChart` — props `{ data: Record<string, number | string>[]; index: string; categories: string[]; className?: string }`, rounded bar tops, `cat-*` in order. `DonutChart` — props `{ data: { name: string; value: number }[]; className?: string }`, slices `cat-*` in order.

- [ ] **Step 1: Write the failing test**

```tsx
// components/charts/bar-donut.test.tsx
import { render } from '@testing-library/react'
import { BarChart } from './bar-chart'
import { DonutChart } from './donut-chart'

test('BarChart renders without crashing', () => {
  const data = [
    { day: 'Mon', spend: 20 },
    { day: 'Tue', spend: 35 },
  ]
  const { container } = render(
    <div style={{ width: 400, height: 200 }}>
      <BarChart data={data} index="day" categories={['spend']} />
    </div>
  )
  expect(container).toBeTruthy()
})

test('DonutChart renders without crashing', () => {
  const { container } = render(
    <div style={{ width: 240, height: 240 }}>
      <DonutChart data={[{ name: 'Rent', value: 40 }, { name: 'Food', value: 60 }]} />
    </div>
  )
  expect(container).toBeTruthy()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- bar-donut`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement BarChart**

```tsx
// components/charts/bar-chart.tsx
'use client'
import {
  Bar,
  CartesianGrid,
  BarChart as ReBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import { seriesColor } from './chart-theme'

export interface BarChartProps {
  data: Record<string, number | string>[]
  index: string
  categories: string[]
  className?: string
}

export function BarChart({ data, index, categories, className }: BarChartProps) {
  return (
    <div className={cn('h-64 w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--ink-soft)" strokeOpacity={0.12} vertical={false} />
          <XAxis dataKey={index} tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-soft)', fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} width={40} tick={{ fill: 'var(--ink-soft)', fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: 'var(--brand-100)', opacity: 0.4 }}
            contentStyle={{
              borderRadius: 14,
              border: '1px solid var(--glass-line)',
              background: 'var(--glass)',
              backdropFilter: 'blur(22px)',
              color: 'var(--ink)',
            }}
          />
          {categories.map((c, i) => (
            <Bar key={c} dataKey={c} fill={seriesColor(i)} radius={[6, 6, 0, 0]} isAnimationActive={false} />
          ))}
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: Implement DonutChart**

```tsx
// components/charts/donut-chart.tsx
'use client'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { cn } from '@/lib/utils'
import { seriesColor } from './chart-theme'

export interface DonutChartProps {
  data: { name: string; value: number }[]
  className?: string
}

export function DonutChart({ data, className }: DonutChartProps) {
  return (
    <div className={cn('h-60 w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={2}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={seriesColor(i)} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 14,
              border: '1px solid var(--glass-line)',
              background: 'var(--glass)',
              backdropFilter: 'blur(22px)',
              color: 'var(--ink)',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- bar-donut`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add components/charts/bar-chart.tsx components/charts/donut-chart.tsx components/charts/bar-donut.test.tsx
git commit -m "feat(charts): add BarChart + DonutChart on cat-* palette"
```

---

### Task 11: HeroCard

**Files:**
- Create: `components/dashboard/hero-card.tsx`
- Test: `components/dashboard/hero-card.test.tsx`

**Interfaces:**
- Consumes: `DeltaPill` (Task 5), `Sparkline` (Task 9), `Stat` (Task 6).
- Produces: `HeroCard` — props `{ label: string; value: number; format?: (n: number) => string; delta?: number; deltaSuffix?: string; trend?: number[]; className?: string }`. Brand gradient surface, white text, soft teal orb, headline number, delta pill, inline sparkline.

- [ ] **Step 1: Write the failing test**

```tsx
// components/dashboard/hero-card.test.tsx
import { render, screen } from '@testing-library/react'
import { HeroCard } from './hero-card'

test('renders label and headline value', () => {
  render(
    <div style={{ width: 600 }}>
      <HeroCard label="Net worth" value={2420.1} format={(n) => `$${n.toFixed(2)}`} delta={2.6} deltaSuffix="%" trend={[1, 2, 3]} />
    </div>
  )
  expect(screen.getByText('Net worth')).toBeInTheDocument()
  expect(screen.getByText('$2420.10')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- hero-card`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```tsx
// components/dashboard/hero-card.tsx
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Sparkline } from '@/components/charts/area-chart'
import { Stat } from '@/components/ui/stat'
import { cn } from '@/lib/utils'

export interface HeroCardProps {
  label: string
  value: number
  format?: (n: number) => string
  delta?: number
  deltaSuffix?: string
  trend?: number[]
  className?: string
}

export function HeroCard({
  label,
  value,
  format,
  delta,
  deltaSuffix = '',
  trend,
  className,
}: HeroCardProps) {
  const positive = (delta ?? 0) >= 0
  const Icon = positive ? ArrowUp : ArrowDown
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 to-brand-700 p-6 text-white shadow-glass',
        className
      )}
    >
      <div
        aria-hidden="true"
        className="-right-10 -top-10 pointer-events-none absolute size-48 rounded-full opacity-40 blur-2xl"
        style={{ background: 'radial-gradient(circle, var(--cat-teal), transparent 70%)' }}
      />
      <div className="relative flex flex-col gap-3">
        <span className="font-medium text-sm text-white/70 uppercase tracking-wide">
          {label}
        </span>
        <Stat value={value} format={format} className="text-white" />
        {delta !== undefined && (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 font-medium text-sm tabular-nums">
            <Icon className="size-3.5" aria-hidden="true" />
            {`${positive ? '+' : '−'}${Math.abs(delta)}${deltaSuffix}`}
          </span>
        )}
        {trend && trend.length > 0 && (
          <div className="mt-2 text-white/80">
            <Sparkline data={trend} />
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- hero-card`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/hero-card.tsx components/dashboard/hero-card.test.tsx
git commit -m "feat(dashboard): add HeroCard (brand gradient + orb + sparkline)"
```

---

### Task 12: ListRow

**Files:**
- Create: `components/dashboard/list-row.tsx`
- Test: `components/dashboard/list-row.test.tsx`

**Interfaces:**
- Produces: `ListRow` — props `{ title: string; subtitle?: string; amount: number; income?: boolean; categoryColor?: string; format?: (n: number) => string; className?: string }`. Category dot (uses `categoryColor` CSS-var ref or defaults to `var(--cat-blue)`), title/subtitle on the left, amount right-aligned `tabular-nums`; income → `text-pos`, else `text-ink`. Hairline `glass-line` bottom border.

- [ ] **Step 1: Write the failing test**

```tsx
// components/dashboard/list-row.test.tsx
import { render, screen } from '@testing-library/react'
import { ListRow } from './list-row'

test('income amount uses pos token; expense uses ink', () => {
  const { rerender } = render(
    <ListRow title="Salary" amount={2500} income format={(n) => `$${n}`} />
  )
  expect(screen.getByText('$2500').className).toContain('text-pos')

  rerender(<ListRow title="Rent" amount={1200} format={(n) => `$${n}`} />)
  expect(screen.getByText('$1200').className).toContain('text-ink')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- list-row`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```tsx
// components/dashboard/list-row.tsx
import { cn } from '@/lib/utils'

export interface ListRowProps {
  title: string
  subtitle?: string
  amount: number
  income?: boolean
  categoryColor?: string
  format?: (n: number) => string
  className?: string
}

export function ListRow({
  title,
  subtitle,
  amount,
  income = false,
  categoryColor = 'var(--cat-blue)',
  format = (n) => n.toLocaleString(),
  className,
}: ListRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 border-glass-line border-b py-3 last:border-b-0',
        className
      )}
    >
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: categoryColor }}
      />
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-ink text-sm">{title}</span>
        {subtitle && <span className="truncate text-ink-soft text-xs">{subtitle}</span>}
      </div>
      <span
        className={cn(
          'ml-auto font-medium text-sm tabular-nums',
          income ? 'text-pos' : 'text-ink'
        )}
      >
        {`${income ? '+' : ''}${format(amount)}`}
      </span>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- list-row`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/list-row.tsx components/dashboard/list-row.test.tsx
git commit -m "feat(dashboard): add ListRow (category dot, tabular amount)"
```

---

### Task 13: NavRail + Sidebar

**Files:**
- Create: `components/dashboard/nav-rail.tsx`
- Test: `components/dashboard/nav-rail.test.tsx`

**Interfaces:**
- Produces: `NavRail` — props `{ items: { label: string; href: string; icon: React.ComponentType<{ className?: string }>; active?: boolean }[]; className?: string }`. Renders a semantic `<nav aria-label="Main">` glass icon rail; each item is an `<a>` with an accessible name (`aria-label={label}` + `title`); active item → `bg-brand text-white`; icon-only with `aria-hidden` icon. Responsive: vertical rail on `md+`, horizontal bottom bar on small screens (utility classes only).

- [ ] **Step 1: Write the failing test**

```tsx
// components/dashboard/nav-rail.test.tsx
import { render, screen } from '@testing-library/react'
import { Home, Settings } from 'lucide-react'
import { NavRail } from './nav-rail'

const items = [
  { label: 'Overview', href: '/', icon: Home, active: true },
  { label: 'Settings', href: '/settings', icon: Settings },
]

test('renders accessible named links and marks active', () => {
  render(<NavRail items={items} />)
  const overview = screen.getByRole('link', { name: 'Overview' })
  expect(overview).toBeInTheDocument()
  expect(overview.className).toContain('bg-brand')
  expect(screen.getByRole('link', { name: 'Settings' }).className).not.toContain('bg-brand')
})

test('exposes a labelled navigation landmark', () => {
  render(<NavRail items={items} />)
  expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- nav-rail`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```tsx
// components/dashboard/nav-rail.tsx
import Link from 'next/link'
import type * as React from 'react'
import { cn } from '@/lib/utils'

export interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  active?: boolean
}

export interface NavRailProps {
  items: NavItem[]
  className?: string
}

export function NavRail({ items, className }: NavRailProps) {
  return (
    <nav
      aria-label="Main"
      className={cn(
        'glass flex gap-1 rounded-4xl p-2',
        'flex-row md:flex-col',
        className
      )}
    >
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            title={item.label}
            aria-current={item.active ? 'page' : undefined}
            className={cn(
              'flex size-11 items-center justify-center rounded-2xl transition-colors motion-safe:transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              item.active
                ? 'bg-brand text-white'
                : 'text-ink-soft hover:bg-brand-50 hover:text-ink'
            )}
          >
            <Icon className="size-5" />
            <span className="sr-only">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
```

Note: the `<span className="sr-only">` plus `aria-label` both name the link; Testing Library's accessible-name resolves to `item.label`. The icon has no `aria-hidden` because it carries no text — the label comes from `aria-label`/`sr-only`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- nav-rail`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/nav-rail.tsx components/dashboard/nav-rail.test.tsx
git commit -m "feat(dashboard): add accessible NavRail (icon rail → bottom bar)"
```

---

### Task 14: Badge — pos/neg/neutral tones

**Files:**
- Modify: `components/ui/badge.tsx`
- Test: `components/ui/badge.test.tsx`

**Interfaces:**
- Produces: `Badge` with `variant` including `pos | neg | neutral | brand` (plus existing). `badgeVariants` export retained.

- [ ] **Step 1: Write the failing test**

```tsx
// components/ui/badge.test.tsx
import { render, screen } from '@testing-library/react'
import { Badge } from './badge'

test('pos variant uses pos-soft background', () => {
  render(<Badge variant="pos">Confirmed</Badge>)
  expect(screen.getByText('Confirmed').className).toContain('bg-pos-soft')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- "ui/badge"`
Expected: FAIL (no `pos` variant).

- [ ] **Step 3: Implement** — read the existing `components/ui/badge.tsx`, then add these entries to the `variants.variant` map in `badgeVariants` (keep existing entries):

```tsx
pos: 'border-transparent bg-pos-soft text-pos',
neg: 'border-transparent bg-neg-soft text-neg',
neutral: 'border-glass-line bg-glass text-ink-soft',
brand: 'border-transparent bg-brand text-white',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- "ui/badge"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ui/badge.tsx components/ui/badge.test.tsx
git commit -m "feat(ui): add pos/neg/neutral/brand badge tones"
```

---

### Task 15: Showcase route `/design`

**Files:**
- Create: `app/design/page.tsx`

**Interfaces:**
- Consumes: every primitive/composite/chart from Tasks 2–14, plus existing `ThemeSwitcher`.
- Produces: a client page rendering each component with sample data over the gradient background. No test (visual review surface); verified via build.

- [ ] **Step 1: Implement the showcase page**

```tsx
// app/design/page.tsx
'use client'
import { Home, LineChart, Settings, Wallet } from 'lucide-react'
import { useState } from 'react'
import { AreaChart } from '@/components/charts/area-chart'
import { BarChart } from '@/components/charts/bar-chart'
import { DonutChart } from '@/components/charts/donut-chart'
import { HeroCard } from '@/components/dashboard/hero-card'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { ListRow } from '@/components/dashboard/list-row'
import { NavRail } from '@/components/dashboard/nav-rail'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DeltaPill } from '@/components/ui/delta-pill'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented-control'

const usd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
const trendData = [
  { month: 'Jan', net: 1800 },
  { month: 'Feb', net: 2000 },
  { month: 'Mar', net: 1950 },
  { month: 'Apr', net: 2200 },
  { month: 'May', net: 2300 },
  { month: 'Jun', net: 2420 },
]

export default function DesignShowcase() {
  const [range, setRange] = useState('m')
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 p-8">
      <header className="flex items-center justify-between">
        <h1 className="font-display font-bold text-3xl text-ink tracking-tight">
          Finova components
        </h1>
        <ThemeSwitcher />
      </header>

      <section className="flex flex-wrap items-center gap-3">
        <Button variant="brand">Primary</Button>
        <Button variant="glass">Glass</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="outline">Outline</Button>
        <SegmentedControl
          aria-label="Range"
          value={range}
          onValueChange={setRange}
          options={[
            { label: 'Day', value: 'd' },
            { label: 'Week', value: 'w' },
            { label: 'Month', value: 'm' },
          ]}
        />
        <DeltaPill value={2.6} suffix="%" />
        <DeltaPill value={-1.2} suffix="%" />
        <Badge variant="pos">Confirmed</Badge>
        <Badge variant="neutral">Draft</Badge>
        <Input aria-label="Search" placeholder="Search…" className="max-w-xs" />
      </section>

      <section className="grid gap-6 md:grid-cols-[auto_1fr]">
        <NavRail
          items={[
            { label: 'Overview', href: '#', icon: Home, active: true },
            { label: 'Wallet', href: '#', icon: Wallet },
            { label: 'Analytics', href: '#', icon: LineChart },
            { label: 'Settings', href: '#', icon: Settings },
          ]}
        />
        <div className="grid gap-6">
          <HeroCard
            label="Net worth"
            value={2420.1}
            format={usd}
            delta={2.6}
            deltaSuffix="%"
            trend={trendData.map((d) => d.net)}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard label="Balance" value={32390} format={usd} delta={7.4} deltaSuffix="%" footnote="vs last month" />
            <KpiCard label="Spending" value={1232} format={usd} delta={-3.4} deltaSuffix="%" footnote="vs last month" />
            <KpiCard label="Investments" value={9876.8} format={usd} delta={1.1} deltaSuffix="%" footnote="vs last month" />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <h2 className="mb-4 font-display font-semibold text-ink text-lg">Net worth trend</h2>
          <AreaChart data={trendData} index="month" categories={['net']} />
        </GlassCard>
        <GlassCard>
          <h2 className="mb-4 font-display font-semibold text-ink text-lg">Spending by month</h2>
          <BarChart data={trendData.map((d) => ({ month: d.month, spend: d.net / 2 }))} index="month" categories={['spend']} />
        </GlassCard>
        <GlassCard>
          <h2 className="mb-4 font-display font-semibold text-ink text-lg">Categories</h2>
          <DonutChart
            data={[
              { name: 'Rent', value: 40 },
              { name: 'Food', value: 25 },
              { name: 'Transport', value: 15 },
              { name: 'Fun', value: 20 },
            ]}
          />
        </GlassCard>
        <GlassCard>
          <h2 className="mb-4 font-display font-semibold text-ink text-lg">Recent activity</h2>
          <ListRow title="Salary" subtitle="Acme Inc" amount={2500} income format={usd} categoryColor="var(--cat-lime)" />
          <ListRow title="Rent" subtitle="Monthly" amount={1200} format={usd} categoryColor="var(--cat-rose)" />
          <ListRow title="Groceries" subtitle="Whole Foods" amount={84.2} format={usd} categoryColor="var(--cat-teal)" />
        </GlassCard>
      </section>
    </main>
  )
}
```

- [ ] **Step 2: Verify build + lint + full test suite**

Run: `npm run lint && npm run typecheck && npm run test && npm run build`
Expected: all pass; `/design` compiles.

- [ ] **Step 3: Manual visual check (optional but recommended)**

Run: `npm run dev`, open `http://localhost:3000/design`, toggle theme.
Expected: glass cards over gradient, brand hero, charts in cat-* palette, readable in light + dark.

- [ ] **Step 4: Commit**

```bash
git add app/design/page.tsx
git commit -m "feat(design): add /design component showcase route"
```

---

## Self-Review

**Spec coverage:**
- §2 Token foundation → Task 1 (tokens, gradient, glass utility, motion reset, aliases, fonts). ✓
- §3 `ui/` primitives → Button (T2), GlassCard (T3), Input (T4), Badge (T14), SegmentedControl (T7), DeltaPill (T5), Stat (T6). ✓
- §3 composites → HeroCard (T11), KpiCard (T8), NavRail/Sidebar (T13), ListRow/DataTable row (T12). ✓ (Sidebar = NavRail responsive variant; a separate full Sidebar shell is deferred with product views per §7.)
- §3 charts → AreaChart/Sparkline (T9), BarChart/DonutChart (T10). ✓
- §4 showcase → Task 15. ✓
- §5 a11y → focus rings (all), accessible names (NavRail T13), color+icon (DeltaPill T5), tabular money (Stat/ListRow/DeltaPill), reduced motion (T1 global + motion-safe). ✓
- §6 testing → every primitive/composite has a test; charts smoke-tested. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. ✓

**Type consistency:** `seriesColor`/`CAT_SERIES`/`BRAND_LINE` defined T9, consumed T9–T10. `Sparkline` defined T9, consumed in HeroCard T11. `Stat`/`DeltaPill`/`GlassCard` defined T3/T5/T6, consumed in KpiCard T8 and HeroCard T11. `format` signature `(n: number) => string` consistent across Stat, KpiCard, HeroCard, ListRow. ✓

**Note on DataTable:** the spec mentions "DataTable row" — implemented as `ListRow`; a full sortable table is out of scope (§7, composed with product views).
