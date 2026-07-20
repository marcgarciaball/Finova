# Finova Dashboard Redesign — Design Spec

**Date:** 2026-06-29
**Status:** Approved (design), pending implementation plan
**Scope:** Composition, hierarchy, and UX over existing dashboard data. **No new backend features.**

## Goal

Redesign `/protected` (the "Panel" dashboard) from an inconsistent vertical stack of
cards into a coherent, single-screen command center built on four narrative bands and
one 12-column grid. A user should instantly understand their whole financial picture
and what to do next. Keep the existing design system (Apple-clean off-white, soft glass
cards, midnight-blue `#1E3A8A`, light/dark, responsive, bilingual ES/EN).

## Concrete problems being fixed

1. **Redundancy.** "Flujo de caja neto", "Saldo total" and "Patrimonio neto" all show the
   same value. Show **Net Worth once** as the top hero; show **Net Cash Flow only as a
   KPI**; **drop the duplicate "Saldo total" tile**.
2. **Hero emphasis.** Biggest card = Net Worth + month trend, not net cash flow. Savings
   rate and net flow become secondary KPIs.
3. **Data-health banner** when a large share is uncategorized.
4. **Empty/onboarding states**, especially the category donut when only "Sin categoría".
5. **Currency clarity.** Net worth is per-currency. Base currency labeled; foreign activity
   (e.g. `-3,50 US$`) flagged, never folded into the EUR total.

## Layout system

- One 12-column grid (`grid-cols-12`), uniform gap (`gap-4 md:gap-5`), one card radius and
  elevation (existing `glass` utility), one type scale.
- New `BandSection` component: muted narrative heading (the band's question) + responsive
  grid. Keeps `app/protected/page.tsx` declarative; each band is self-contained.
- Mobile: every band collapses to a single stacked column.
- One hero number per band; remove the huge-vs-micro tile size jumps.

## The four bands

### Band 1 — "¿Cuánto tengo? / How much do I have?"
- **Net Worth hero** (repurpose `HeroCard`, `lg:col-span-8`): the single net-worth number
  for the base currency + prominent month-over-month area trend inside the card. Largest
  card on the page.
- **Currency breakdown** (`lg:col-span-4`): base currency labeled clearly; if other
  currencies have activity, each shown on its own line — never folded into the EUR total.
- **Accounts strip** (full width, row 2): every account larger than today
  (name · type · balance · currency) side by side + clear **"+ add account"** linking to
  `/protected/accounts`.
- **Removed:** duplicate "Saldo total" tile; redundant top "Patrimonio neto" label. Net
  worth appears exactly once, here.

### Band 2 — "¿Gano más de lo que gasto? / Earning vs spending?"
- **4 equal KPIs** (`lg:col-span-5`, 2×2): Income · Expenses · Savings rate · Net cash flow
  (demoted from hero) — each with a vs-previous-period `DeltaPill` (↑/↓ %).
- **Income vs expense bar chart** beside them (`lg:col-span-7`).

### Band 3 — "¿A dónde va mi dinero? / Where does it go?" (core)
- **Donut + Top-categories ranking** side by side (`5` / `7`), sharing the period. Ranking
  rows get an up/down **trend arrow per category** vs previous period. If only
  "Sin categoría" exists, the donut is **replaced by a categorize prompt** (same action as
  the banner), not a single-color donut.
- **Spending across accounts** panel.
- **Key stats** (avg spend · biggest expense · busiest day · count) as a uniform 4-tile
  strip within this band.
- **Balance/net-worth evolution** area chart, full width.

### Band 4 — "¿Qué pasa? / What's happening?"
- **Recent activity** (`lg:col-span-7`): 5–6 rows + "ver todos".
- **Phase-3 Insights placeholder** (`lg:col-span-5`): styled glass card with heading +
  muted preview rows for narrative / leak finder / forecast, so the layout already has a
  home for them. Bilingual, dark-mode aware.

## Data-health banner

- Full-width, above Band 1. Shown when the uncategorized **share ≥ 40%** (the 858 € / 100%
  case triggers it).
- Text: e.g. *"858 € sin categorizar — organízalo"*.
- Action: **inline one-click** — button calls the existing
  `recategorizeUncategorized()` server action (in
  `app/protected/transactions/actions.ts`) directly from the dashboard, shows a toast
  (`n categorized`), then revalidates in place. No page change.
- Dismissal: persisted in `localStorage`, keyed by the uncategorized amount, so the banner
  **reappears if new uncategorized spending appears** but stays dismissed otherwise.

## Deltas — new pure domain logic (no backend)

`getDashboardData()` already loads the full transaction history; period filtering is a
slice. So deltas need no DB change — only pure functions (TDD + unit tests):

- New `lib/domain/dashboard/compare.ts`:
  - Compute the **prior window** of equal length immediately preceding the current period.
  - Previous totals → % deltas for Income, Expenses, Net cash flow, Savings rate.
  - Previous per-category totals → trend direction (up/down/flat) for the ranking.
- Net-worth delta = current net worth vs balance at period start.
- For `all` (no prior window) and zero-baseline cases, deltas hide gracefully (no pill /
  neutral state).

## Period selector drives everything

Already URL-driven via `?period=` and server re-render. Every panel — including the new
deltas, banner threshold, donut, and ranking trends — recomputes from the same period
slice. Each panel verified to respond to period changes.

## Cross-cutting

- **i18n:** add ES/EN keys for band headings, banner text/action, insights placeholder,
  "vs last period" delta label, and the base-currency note.
- **Light/dark & responsive:** all new components use existing CSS-variable tokens; bands
  stack on mobile.
- **Empty states per panel:** net-worth/accounts onboarding (no accounts), donut
  categorize-prompt, ranking/recent/charts empty (most already exist).

## New vs changed files

**New**
- `app/protected/BandSection.tsx` — band heading + responsive 12-col grid wrapper.
- `app/protected/DataHealthBanner.tsx` — client banner + inline recategorize action,
  localStorage dismissal.
- `app/protected/InsightsPlaceholder.tsx` — Phase-3 styled placeholder card.
- `app/protected/CurrencyBreakdown.tsx` — per-currency net-worth panel.
- `lib/domain/dashboard/compare.ts` (+ `compare.test.ts`) — prior-window deltas & category
  trend.

**Changed**
- `app/protected/page.tsx` — recomposed into the 4 bands; removes duplicate tiles; wires
  deltas and banner.
- `components/dashboard/KpiCard.tsx` usages — populate `delta`.
- `app/protected/SpendingRanking.tsx` — per-category trend arrow.
- `components/charts/DonutChart.tsx` (or its wrapper) — categorize-prompt empty state.
- `components/dashboard/HeroCard.tsx` — repurposed for net worth.
- `messages/en.json`, `messages/es.json` — new keys.

## Testing & verification

- TDD for `compare.ts` (prior-window slicing, % deltas, category trend, edge cases:
  `all` period, zero baselines, multi-currency).
- Existing dashboard domain tests stay green.
- Build + lint (Biome) clean.
- Manual visual check: light/dark, ES/EN, mobile stack, period selector drives all panels,
  banner appears/dismisses, donut empty state.

## Out of scope

- No new backend features, tables, or queries.
- No new categorization-rule editor UI (reuse existing recategorize action).
- No Phase-3 insight logic (placeholder only).
