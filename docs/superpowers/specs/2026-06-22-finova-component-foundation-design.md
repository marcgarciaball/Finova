# Finova — Component Foundation Design

**Date:** 2026-06-22
**Status:** Approved (brainstorming) — pending implementation plan
**Scope:** Token foundation + reusable primitives + chart wrappers + showcase route

---

## 1. Goal & decisions

Build the reusable component foundation that every Finova view (dashboards,
schedules, analytics, watchlists) will compose from. This is the base layer —
not a finished product view.

Locked decisions from brainstorming:

- **Deliverable:** Foundation + primitives (token wiring, fonts, utilities, core
  primitives, chart wrappers, a showcase page).
- **Style authority:** The design system in `CLAUDE.md` is authoritative. The
  inspiration images are references for layout quality, spacing, and
  Apple-level polish **only** — never for palette or font. Where they conflict
  (neomorphism, lime/black accents, Urbanist), the design system wins.
- **Charts:** Tremor-Raw-style wrappers built on **Recharts** (the only path
  compatible with this project's Tailwind v4 CSS-first setup; the legacy
  `@tremor/react` package requires a v3 `tailwind.config.js` preset and is
  excluded).

### Project constraints discovered

- **Tailwind v4**, CSS-first config via `@theme` in `app/globals.css`. The v3
  `tailwind.config.ts` in the design-system doc must be translated to v4.
- The Finova tokens (`brand-*`, `cat-*`, `pos/neg`, `glass`) are **not yet
  wired in** — `globals.css` currently carries the default shadcn neutral
  palette. Wiring them is step one.
- An existing shadcn-style `components/ui/` layer (button, card, input, badge,
  checkbox, dropdown, label) uses CVA + `cn` and references the old tokens.
  New components follow the same pattern on the new tokens; old token names are
  aliased so existing auth components keep working.
- Stack: Next.js 16, React 19, Tailwind v4, `class-variance-authority`,
  `clsx` + `tailwind-merge` (`cn`), `lucide-react`, `next-themes`,
  `next-intl`, Vitest + Testing Library + jsdom.

---

## 2. Token foundation

Rewrite `app/globals.css` to replace the shadcn neutral palette with Finova
tokens, expressed in Tailwind v4 syntax.

- **CSS variables** for both themes: `:root` (light) and `.dark`.
  - Brand scale: `--brand-50,100,300,500,600,700,900,950`.
  - Categorical: `--cat-blue,teal,violet,amber,rose,lime`.
  - Semantic: `--pos`, `--pos-soft`, `--neg`, `--neg-soft`.
  - Ink: `--ink`, `--ink-2`, `--ink-soft`.
  - Glass: `--glass`, `--glass-line`.
  - Background stops: `--bg-a`, `--bg-b`.
  - Values taken verbatim from the design-system doc (§2/§3), light + dark.
- **`@theme inline`** maps each var to a Tailwind color utility, so
  `bg-brand`, `text-ink`, `text-pos`, `border-glass-line`, `fill-cat-teal`,
  etc. all resolve. `brand` exposes `DEFAULT` = `brand-900`.
- **Radii** `--radius-xl:14px … --radius-4xl:26px`.
- **Shadows** `--shadow-soft`, `--shadow-glass` (from doc §3).
- **`--blur-glass: 22px`** → `backdrop-blur-glass`.
- **Fonts** via `next/font` in `app/layout.tsx`: Inter (sans), Inter Tight
  (display), JetBrains Mono (mono); exposed as `--font-sans/display/mono` and
  mapped in `@theme`.
- **Body background**: the multi-stop gradient (brand-100 halo top-left + teal
  glow top-right + cream base), `background-attachment: fixed`.
- **Reduced motion**: a global `@media (prefers-reduced-motion: reduce)` block
  disabling transitions/animations.
- **Back-compat aliases**: keep `--primary`, `--background`, `--border`,
  `--ring`, etc. defined (pointing at the new ink/brand/glass values) so
  existing auth components and `ui/` primitives render correctly without a
  rewrite in this pass.

### A `.glass` utility

A reusable class for glass surfaces:
`bg-glass backdrop-blur-glass border border-glass-line rounded-3xl shadow-glass`.
Defined once (component-layer `@utility` or a `GlassCard` component) so surfaces
stay consistent.

---

## 3. Component architecture

Three layers, all following the existing CVA + `cn` convention, all shipping
light + dark and reduced-motion aware.

### `components/ui/` — branded primitives

- **Button** — extend existing variants: add `brand` (`bg-brand text-white`,
  soft shadow), `glass` (glass + `border-glass-line`), keep `ghost`/`link`;
  default height 40–44px; visible `ring-brand-500` focus.
- **GlassCard** (and/or extend `Card`) — the default surface; hover lift
  (`-translate-y-0.5` + shadow, 300ms ease-out, motion-safe only).
- **Input** — glass fill, soft border, `rounded-2xl`, `ring-2 ring-brand-500`
  focus.
- **Badge** — extend with `pos`/`neg`/`neutral` tones using soft backgrounds.
- **SegmentedControl** (new) — glass pill container, active item = lighter
  glass + soft shadow (Apple Day/Wk/Mo pattern); keyboard + ARIA
  (`role="tablist"`/radio group semantics).
- **DeltaPill** (new) — `pos-soft`/`neg-soft` pill with +/− sign **and** an
  arrow icon (never color-only); `tabular-nums`.
- **Stat** (new) — large `Inter Tight` tabular number with optional count-up
  animation on mount (disabled under reduced motion).

### `components/dashboard/` — composites

- **HeroCard** — net-worth card: `brand-900 → brand-700` gradient, white text,
  one soft teal radial orb, headline number, a `DeltaPill`, inline
  `Sparkline`. The single boldest element.
- **KpiCard** — label (`ink-soft`) · big tabular `Stat` · `DeltaPill` ·
  comparison footnote.
- **NavRail** + **Sidebar** — slim glass icon rail, active item = solid
  `bg-brand text-white`; accessible names + tooltips on icon-only items;
  collapses to a bottom bar on mobile (responsive). Semantic `<nav>`.
- **ListRow** / **DataTable row** — hairline `glass-line` dividers, generous
  row height, category color dot from `cat-*`, amount right-aligned and
  `tabular-nums`; income in `pos`, plain expense amounts in `ink`.

### `components/charts/` — Tremor-Raw-style wrappers on Recharts

- **AreaChart / Sparkline** — single series → `brand-600` with vertical
  gradient fill (28%→0%); multi-series pulls `cat-*` in fixed order.
- **BarChart** — rounded bar tops, thin low-opacity gridlines, `cat-*` in
  order, tabular axis labels; current period highlighted in `cat-teal`.
- **DonutChart** — slices from `cat-*` in order.
- Shared: hover tooltip (exact value + label), entrance animation gated on
  motion-safe, consistent axis/tooltip styling pulled from tokens.

---

## 4. Showcase route

A `/design` route (App Router page, not linked from app nav) rendering every
primitive and composite in a sectioned layout over the gradient background,
with a light/dark toggle (reusing `next-themes` / existing `ThemeSwitcher`).
Serves as the visual review surface and living reference.

---

## 5. Accessibility & quality bar (non-negotiable, design-system §7)

- WCAG AA text contrast on glass — bump glass opacity / add solid layer behind
  text where a region is busy.
- Visible focus rings everywhere (`ring-brand-500`); logical tab order;
  semantic HTML.
- Meaning never by color alone — pos/neg always carry +/− and an icon.
- Min tap target 40px; responsive mobile → desktop (rail → bottom bar).
- All motion wrapped in `motion-safe` / disabled under
  `prefers-reduced-motion: reduce`.

---

## 6. Testing

Vitest + Testing Library (already configured) — one focused test file per
primitive/composite:

- Renders without crashing; correct variant classes applied.
- Accessibility: accessible name present on icon-only controls; DeltaPill
  exposes sign + icon (not color only); focusable controls are reachable.
- SegmentedControl: keyboard selection + `aria-selected`/checked state.
- Stat: renders the value immediately (count-up does not hide content);
  no animation assertion needed beyond presence.

Charts get a light smoke test (renders with sample data, no a11y assertion on
the SVG internals).

---

## 7. Out of scope (YAGNI)

- Full product views (Overview/Schedule/Analytics) — composed in a later pass.
- Real data, Supabase queries, or i18n message extraction for component copy.
- Per-request CSP nonce work (tracked separately under P5-05).
- Replacing tokens in existing auth components beyond the back-compat aliasing.

---

## 8. File-level change list

- `app/globals.css` — rewrite tokens (v4), gradient bg, glass utility, motion
  reset, back-compat aliases.
- `app/layout.tsx` — wire Inter / Inter Tight / JetBrains Mono via `next/font`.
- `components/ui/` — extend Button, Card→GlassCard, Input, Badge; add
  SegmentedControl, DeltaPill, Stat.
- `components/dashboard/` — HeroCard, KpiCard, NavRail, Sidebar, ListRow,
  DataTable row.
- `components/charts/` — AreaChart/Sparkline, BarChart, DonutChart (+ shared
  config).
- `app/design/page.tsx` — showcase.
- `package.json` — add `recharts`.
- Test files colocated per component (`*.test.tsx`).
