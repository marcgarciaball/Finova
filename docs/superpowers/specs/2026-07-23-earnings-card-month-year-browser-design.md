# Earnings Card: Month/Year Browser — Design

## Problem

The "¿Cuánto gano?" (Earnings) card pins itself to a single "reference month" — the current month if it has *any* income, otherwise the latest month with income — and shows only that month's categorized income. This causes real bugs:

- A salary transaction dated in a past month (e.g. June) silently disappears once the current month (July) has *any* other income (rent, an uncategorized transfer), because the reference-month logic never looks at June again.
- Rent, computed as a trailing-12-month average (to match the Real Estate page), doesn't correspond to any real month a user can point to, and the card gives no way to look at a different month or a whole year.
- There's no way to see historical income at all — no way to check what a specific past month, or year, actually looked like.

Separately, ambiguous incoming money (Bizum reimbursements, uncategorized transfers, the generic "Transacciones" catch-all) is currently excluded from the card by hardcoded category name, which is already the right mechanism — this spec keeps that mechanism as-is (see Non-goals).

## Goals

- Replace the single pinned "reference month" with a genuinely browsable month view (prev/next arrows) and a separate browsable year view (prev/next arrows), so any month or year with real data can be inspected directly.
- Fix the salary-disappearing bug as a natural consequence: whichever month is selected shows exactly that month's real transactions.
- Year view shows real annual totals (not averages) for every income source.
- Keep dividends and rent smoothed (trailing-12-month average) in month view only, since a single month of lumpy/prorated data isn't representative on its own; year view uses their real annual totals.
- Uncategorized income is excluded from the card everywhere (same treatment Bizum/Transacciones already get) until the user assigns it a real income category.
- Disable navigation past the bounds of real data (earliest month/year with any account activity) and past the current month/year (no browsing into the future).
- Empty months/years (inside those bounds) show €0 with an empty-state message rather than being skipped.
- The current, not-yet-finished year shows its real total-so-far, labeled as partial ("so far" / "en lo que va de año") — no projection/extrapolation.

## Non-goals

- No change to which categories are excluded (`bizum_income`, `transactions_income`, `uncategorized`) or why — a transaction is included in "how much I earn" purely based on its assigned category, same mechanism as today. A user who wants a specific Bizum/transfer to count as income recategorizes that transaction to a real income category (Salary, Gifts, Other income) — already supported, no new per-transaction flag.
- No change to `is_transfer` handling (still always excluded everywhere, unrelated to this card).
- No projected/extrapolated full-year estimate — "so far" is a real partial sum, not a forecast.
- No change to the Real Estate page's own cards, or to the dashboard's separate Day/Week/Month/Year period selector (`PeriodSelector`) used by other cards — this is scoped to `EarningsCard` and its data assembly in `app/protected/page.tsx` only.

## UI

`EarningsCard`'s current `SegmentedControl` (Día / Mes / Año) changes meaning:

- **Día / Mes** are two ways to express one **browsable month**. Prev/next arrows next to the segmented control step the selected month (`YYYY-MM`) backward/forward. "Mes" shows that month's total; "Día" shows that month's total ÷ days in that month (unchanged arithmetic, just now applied to a real navigable month instead of a pinned one).
- **Año** is a separate **browsable year**, with its own prev/next arrows, independent of whatever month is selected. Switching to "Año" swaps the arrows' target (year instead of month) and shows that year's real totals.
- Arrows are disabled (not hidden) at the bounds: earliest month/year with any account activity (across transactions, rental income, dividends, manual-asset income — whichever is earliest), and the current month/year (no future browsing).
- Footer text changes from the current "Basado en tus ingresos de julio de 2026" to reflect the browsed period: the month/year name in month/year view, with a "so far" qualifier appended when the selected year is the current, incomplete year.
- Empty period: rows list is empty, existing `t('empty')` empty-state text shows, total is €0. This already works today (`rows.length === 0` branch) — just needs to also trigger correctly for a real empty month/year rather than only the "no income at all" case.

## Data model

`EarningsCard` becomes controlled from a client-side perspective for navigation, but data still comes from the server per period. Two viable approaches:

1. **Server Component refetch via URL search params** (`?earningsView=month&earningsPeriod=2026-06`), same pattern as the existing `PeriodSelector`/`period` search param already used elsewhere on this page. Prev/next arrows are links/buttons that update the search param; the page Server Component re-runs `getDashboardData`-adjacent logic for the new period and passes fresh `rows`/totals as props.
2. **Client-side fetch via a new server action** (`getEarningsForPeriod(kind, period)`) called on arrow click, holding rows in local state.

**Recommendation: approach 1** (search params), consistent with how `PeriodSelector` already works on this same page, avoids introducing a second data-fetching pattern, and keeps the card server-rendered by default (no loading spinner needed for the common case of a fresh page load already showing the right period).

## Server-side changes (`app/protected/page.tsx`)

Replace the current `earningsMonth`/`earningMonths` selection block with:

- Read `earningsView: 'month' | 'year'` and `earningsPeriod: string` (either `YYYY-MM` or `YYYY`) from `searchParams`, defaulting to `'month'` and the current month.
- **Month view:**
  - `monthTxns` = transactions whose `occurred_at` falls in the selected month (unchanged filter logic, just driven by the selected month instead of the computed `earningsMonth`).
  - `monthEarningTxns` = `monthTxns` minus excluded categories (`bizum_income`, `transactions_income`, and now also the `null`/uncategorized bucket — see Excluded categories below).
  - `incomeByCategory(monthEarningTxns)` as today.
  - Dividends: `dividendMonthCents` unchanged (trailing 12 months ending at the selected month, or today if the selected month is the current month).
  - Rent: `rentMonthCents` unchanged (trailing-12-month `cashFlowCents` ending at the selected month / today).
  - Manual-asset income: unchanged (already trailing-12 average).
- **Year view:**
  - `yearTxns` = transactions whose `occurred_at` falls in the selected calendar year, clipped to today if it's the current year.
  - `yearEarningTxns` = same exclusion filter as month view.
  - `incomeByCategory(yearEarningTxns)` — real annual total per category (no ÷12, no averaging).
  - Dividends: sum of `receivedEventsBase` within the calendar year (clipped to today), not divided.
  - Rent: `cashFlowCents(rentEvents, propertyExpenseEvents, propertyLoanSnapshots, yearStart, yearEndOrToday)`, real net total for the year, not divided.
  - Manual-asset income: `manualAssetIncomeInRangeCents` over the same year range, not divided.
- Bounds computation: earliest month/year = `min` across the earliest transaction `occurred_at`, earliest rent event `periodStart`, earliest dividend event date, earliest manual-asset income `receivedDate`. Latest = current month/year (`todayIso`).

## Excluded categories

Add `null` (uncategorized) to the existing `EARNINGS_EXCLUDED_CATEGORIES` handling: the current code excludes by `name_key` (`bizum_income`, `transactions_income`); uncategorized rows have `category_id === null` (no `name_key` to check), so this needs a small explicit check (`categoryId === null`) alongside the `name_key` set, not just adding `null` to the `Set<string>`.

## `EarningsCard` component changes

- New props: `view: 'month' | 'year'`, `period: string` (the `YYYY-MM` or `YYYY` currently displayed), `canGoPrev: boolean`, `canGoNext: boolean`, `isPartialYear: boolean` (true when `view === 'year'` and `period` is the current year).
- Prev/next arrows are simple `<Link>`s (or a small client component wrapping `useRouter().push`) that update `earningsPeriod` (and `earningsView` when switching Día/Mes vs Año) in the URL search params, disabled via `canGoPrev`/`canGoNext`.
- "Día" and "Mes" both keep `view=month` and only change the displayed `unit` (existing local `useState<Unit>`, unaffected by this spec) — only "Año" changes `earningsView`.
- Footer text: new i18n keys for month view (`basedOnMonth`, existing `basedOn` reused) and year view (`basedOnYear`, `basedOnYearSoFar`).

## Error handling

No new failure modes — this is read-only aggregation over already-fetched data (transactions, rent events, dividend events, manual-asset events), same as today. Out-of-bounds `earningsPeriod` values from a manually-edited URL clamp to the nearest valid bound (earliest/current) rather than erroring.

## Testing

- Unit tests for the new month/year aggregation helpers in `packages/domain` (wherever the exclusion-filter and range-sum logic is extracted to be pure/testable), covering: a salary transaction in a non-current month is included when that month is selected; uncategorized/Bizum/Transacciones stay excluded in both views; year view sums match manual sums of the underlying events; partial-year flag is set only for the current year.
- No new component/E2E tests planned (matches existing coverage level for `EarningsCard`, which has none today) — manual browser verification per this project's existing constraint (sandboxed dev server can't be driven in this environment).
