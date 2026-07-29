# Ongoing Rent (No End Date) — Plan

Spec: `docs/superpowers/specs/2026-07-29-ongoing-rent-design.md`

**Execution mode:** inline, same session as planning. Lean outline per Marc's standing preference — no full-code-per-step, TDD as usual, small commits per task.

## Task 1 — Schema + migration
- Add `currentRentCents` (bigint, nullable, check null-or->=0) to `properties` in `lib/db/schema/real-estate.ts`.
- Generate migration via `npm run db:generate -- --name add_property_current_rent`; format the generated meta JSON with biome.
- Commit.

## Task 2 — Validation schemas
- `lib/validation/real-estate.ts`: add `current_rent_cents` (nullable, `>= 0`) to `propertyRowSchema`; add optional `currentRent` decimal-string field to `createPropertySchema` and `updatePropertySchema`.
- Commit.

## Task 3 — Domain: `ongoingRentCents` + `annualizedRentCents` update
- `packages/domain/src/real-estate/metrics.ts`: add `isRented`, `rentalStartDate`, `rentalEndDate` (nullable), `currentRentCents` (nullable) to `PropertySnapshot`.
- New `ongoingRentCents(property, loggedIncomes, fromIso, toIso, asOfIso)`: active window `[max(fromIso, rentalStartDate), min(toIso, rentalEndDate ?? asOfIso)]`; per calendar month in that window, skip if any `loggedIncomes` row overlaps the month at all, else add `currentRentCents` prorated by days of that month inside `[fromIso, toIso]`.
- Update `annualizedRentCents`: when `isRented && currentRentCents != null`, return `currentRentCents * 12`; else existing extrapolation logic unchanged.
- Tests in `metrics.test.ts`: `ongoingRentCents` — no contribution when not rented / no rate set; full months with no logged income get the declared rate; a month with any logged row (even partial) is skipped entirely; edge-of-range proration by days; capped by `rentalEndDate`/`asOfIso`. `annualizedRentCents` — returns `currentRentCents*12` when set, falls back otherwise.
- Commit.

## Task 4 — Data layer: property detail page
- `app/protected/real-estate/data.ts` `computeMetrics`: pass `isRented`/`rentalStartDate`/`rentalEndDate`/`currentRentCents` into the `PropertySnapshot` object; fold `ongoingRentCents(p, incomeEvents, ..., todayIso)` into `totalIncomeCents` and the trailing-year cash-flow inputs alongside logged incomes.
- Commit.

## Task 5 — Data layer: dashboard synthesized events
- `app/protected/real-estate/data.ts`: new `getOngoingRentEvents(): Promise<RentalIncomeEvent[]>` — for each property with `isRented` and `currentRentCents` set, synthesize one event per elapsed calendar month since `rentalStartDate` (capped by `rentalEndDate`/today) that has no overlapping logged `rental_income` row, scaled by the property's `ownershipPct` like the other dashboard getters.
- `app/protected/page.tsx`: concatenate `getOngoingRentEvents()` results with `getRentalIncomeEvents()` before the existing `incomeInRangeCents`/`cashFlowCents` calls — no other page.tsx changes.
- Commit.

## Task 6 — UI: PropertyForm current-rent field
- `PropertyForm.tsx`: add "Current monthly rent" optional decimal field, shown only when the `isRented` checkbox is checked (client-side conditional render), included in both create and edit modes.
- `actions.ts`: wire `currentRent` through `createProperty` and `updateProperty` (convert via existing `toCents`/`normalizeDecimal` helpers, store `null` when blank).
- Extend `PropertyForm.test.tsx` for the new field (create submits it; edit pre-fills it; hidden when not rented).
- Commit.

## Task 7 — UI: detail page current-rent stat
- `app/protected/real-estate/[id]/page.tsx`: add a stat next to annualized-rent/yield showing the declared current rent when set.
- Commit.

## Task 8 — End-to-end check
- Run full test suite + typecheck + lint.
- Manually verify (via `run` skill, Marc drives the browser): delete the existing bad €55,819.35 row, set the property's current rent to €600 via Edit, confirm annualized rent/yield/dashboard cash-flow all reflect €600/mo without a lump sum; add a one-off logged rental_income row for a specific month and confirm it overrides the declared rate for that month only.
- Update memory: refresh "Real Estate module state" with ongoing-rent shipped.
