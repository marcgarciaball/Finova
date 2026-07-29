# Real Estate: Edit Property & Ownership Percentage

## Problem

Once a property is added in the Real Estate module, it cannot be edited (no Edit button/dialog exists, despite a working but unused `updateProperty` server action). There is also no way to record partial ownership — every property is implicitly assumed 100% owned by the user, which overstates equity, ROI/yield, and rental income for properties bought jointly with a partner or spouse.

## Data model

Add `ownershipPct` to `properties` (`lib/db/schema/real-estate.ts`):

```
ownershipPct: numeric('ownership_pct', { precision: 5, scale: 2 })
  .notNull()
  .default('100')
```

Check constraint: `ownership_pct > 0 AND ownership_pct <= 100`.

New Drizzle migration (next sequence number), generated via the project's `db-generate` flow. Existing rows backfill to 100 via the column default — no data migration needed beyond that.

`lib/validation/real-estate.ts`: add `ownershipPct` (number, 0 < x <= 100) to `createPropertySchema` and `updatePropertySchema`.

## Domain metrics scaling (`packages/domain/src/real-estate/metrics.ts`)

Ownership percentage applies everywhere a figure rolls up into "your share" totals:

- `equityCents`, `outstandingDebtCents`, `costBasisCents`: value, debt, and cost basis inputs scaled by `ownershipPct / 100` before combining.
- `roiPct`, `grossYieldPct`, `netYieldPct`: numerator and denominator both scaled consistently (kept explicit per-function rather than skipped as a no-op, for consistency with the rest of the module).
- `incomeInRangeCents`, `cashFlowCents`: rental income and expenses scaled.
- `aggregatePortfolio`: sums already-scaled per-property figures into `CurrencyTotals`, so mixed portfolios (e.g. one 100%-owned + one 50%-owned property) sum correctly.

Each affected function gains an `ownershipPct` input (either as an added parameter or read off the property row it already receives — decided at implementation time based on what keeps call sites cleanest). `metrics.test.ts` gets a new case per affected function covering a 50%-owned property.

## Data layer (`app/protected/real-estate/data.ts`)

- `computeMetrics`: passes `ownershipPct` through to the now-scaled domain functions.
- `getRealEstateEquityByCurrency()`: this is a separate raw-SQL equity computation that bypasses `metrics.ts` entirely and feeds net worth directly — it applies `* ownershipPct / 100` inline since it can't reuse `equityCents`.
- `getRentalIncomeEvents()` / `getPropertyExpenseEvents()`: raw event rows stay unscaled — the property detail page shows real, unscaled figures (see below).

## Dashboard (`app/protected/page.tsx`)

- Net worth rollup and the `WealthAllocation` real-estate figure consume the already-scaled `getRealEstateEquityByCurrency()` result — no double-scaling.
- The Earnings-by-category `__rent__` row scales rental income at the aggregation point (not at the raw event level), consistent with equity.

## Property detail page (`app/protected/real-estate/[id]/`)

Purchase price, current value, rent, and expenses continue to show full, real-world figures (matching the deed/contract) — not pre-scaled. Two additions:

1. A small "Your share: {ownershipPct}%" badge/line near the property header.
2. The Equity stat card shows the scaled (your-share) equity, since equity is the figure that feeds net worth and must stay consistent with the dashboard — with a subtext clarifying it reflects ownership share.

## Edit dialog & form

- `PropertyActions.tsx`: add an "Edit" button alongside the existing Sell/Delete buttons, opening a `Dialog` (same structural pattern as the existing `SellDialog`).
- The dialog renders the existing `PropertyForm` component, pre-filled with the property's current values, reused as-is from the Add flow rather than building a separate lean form.
- `PropertyForm.tsx`: add one new field, "Ownership %" (number input, 1–100, default 100), placed near currency/purchase price.
- On submit in edit mode, the form calls the existing `updateProperty` server action instead of `createProperty`. `updateProperty` and `updatePropertySchema` are extended so editing isn't limited to the current subset (name, type, address, city, notes, isRented, rental dates) — it should cover every field `PropertyForm` exposes, including `ownershipPct`, purchase price, current value, and currency.

## Out of scope

- No co-owners list (names/shares of other owners) — a single "your share" percentage only, per explicit decision.
- No retroactive recalculation UI — scaling is applied live wherever metrics are computed; no historical snapshots need backfilling since `propertyValuations` stores raw (unscaled) valuation history.
