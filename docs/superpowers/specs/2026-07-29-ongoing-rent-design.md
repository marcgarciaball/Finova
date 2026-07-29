# Real Estate: Ongoing Rent (No End Date)

## Problem

Rental income entries require a bounded `period_start`/`period_end`. "Monthly rent" entry mode multiplies the monthly amount by the entire span between those dates into a single lump total. A property rented since 2022-04-01 with no fixed end, entered as €600/month with a period end of 2030-01-01 (a placeholder for "still ongoing"), produced a nonsensical €55,819.35 lump-sum row instead of representing an ongoing rent.

The rental-income log was designed for bounded, one-off payment records (e.g. "March rent," "Q1 rent"), not for declaring an indefinite rent rate. Nothing in the UI stops a multi-year span from being entered in "monthly" mode, and the result is silently wrong from a user's perspective even though the math (calendar-aware month counting) is internally consistent.

## Data model

Add `currentRentCents` to `properties` (`lib/db/schema/real-estate.ts`):

```
currentRentCents: bigint('current_rent_cents', { mode: 'number' })
```

Nullable, with a check constraint `current_rent_cents is null or current_rent_cents >= 0`. New migration (next sequence number after 0027).

No new date fields — reuses the existing `isRented`, `rentalStartDate`, `rentalEndDate` columns as the active window: the declared rent applies from `rentalStartDate` through `rentalEndDate` (or today, if `rentalEndDate` is unset) while `isRented` is true. `lib/validation/real-estate.ts`: add `currentRentCents` (nullable, `>= 0`) to `propertyRowSchema`, and a `currentRent` optional decimal-string field to `createPropertySchema`/`updatePropertySchema`.

## Domain functions (`packages/domain/src/real-estate/metrics.ts`)

**`ongoingRentCents(property, loggedIncomes, fromIso, toIso, asOfIso)`** — new pure function. Only contributes when `property.isRented` and `property.currentRentCents` is set. Computes the active window as `[max(fromIso, rentalStartDate), min(toIso, rentalEndDate ?? asOfIso)]`; returns 0 if that window is empty. For each calendar month overlapping the window: if any row in `loggedIncomes` overlaps that month at all, skip it entirely (real data wins for the whole month, per your answer); otherwise add `currentRentCents` prorated by the number of days of that month that fall inside `[fromIso, toIso]`.

This composes with the existing `incomeInRangeCents(loggedIncomes, fromIso, toIso)` rather than replacing it — callers sum both. Neither function's existing signature changes.

**`annualizedRentCents`**: when `property.isRented` and `property.currentRentCents` is set, return `currentRentCents * 12` directly — this is strictly more accurate than extrapolating from historical logged rows for the common "ongoing rent, known rate" case, and is what directly fixes the original lump-sum problem. Falls back to the existing day-span extrapolation from logged incomes when no current rent is declared.

`cashFlowCents` and the yield functions are unchanged — they already consume whatever income total a caller passes in; callers now pass `incomeInRangeCents(...) + ongoingRentCents(...)`.

## Data layer & dashboard (`app/protected/real-estate/data.ts`, `app/protected/page.tsx`)

- `computeMetrics` (detail page): folds `ongoingRentCents(property, incomeEvents, ..., todayIso)` into `totalIncomeCents`, the trailing-year cash flow, and the annual-rent figure it already computes, alongside the logged-income totals.
- Dashboard: a new `getOngoingRentEvents()` getter (mirroring `getRentalIncomeEvents()`) synthesizes one rental-income-shaped event per property per elapsed month since `rentalStartDate` for properties with `currentRentCents` set, applying the same whole-month-exclusion rule against already-logged rows, scaled by ownership share like the other dashboard getters. `page.tsx` itself is untouched — it already sums whatever `rentEvents` it's given through `incomeInRangeCents`/`cashFlowCents`, so the synthesized events just get concatenated with the real logged ones before those calls.
- Ownership-percentage scaling (shipped earlier this session) applies on top unchanged, since it operates on the final combined cents figures.

## UI (`app/protected/real-estate/PropertyForm.tsx`, detail page)

- `PropertyForm`: new "Current monthly rent" optional decimal field, shown only when "Currently rented out" is checked. Present in both create and edit modes — unlike purchase price/current value (locked after creation), rent is expected to change over time (e.g. an increase), so it stays editable.
- Property detail page: a new stat next to the existing annualized-rent/yield figures showing the declared current rent, so the "why is this number what it is" question is always answerable at a glance.

## Cleanup of the existing bad row

No automated migration or heuristic to detect and fix lump-sum rows — too fragile and risks silently altering financial data. Manual fix: delete the existing €55,819.35 entry (delete button already works), then set the property's "Currently rented out" + rental start (2022-04-01) + current rent (€600) via the Edit dialog.

## Out of scope

- No rent-change history — editing `currentRentCents` changes the *declared rate as of now*; retroactive annualized/yield figures back to `rentalStartDate` use whatever the field currently holds. A user who needs accurate historical figures across a rent increase should keep logging discrete `rental_income` rows for the periods that matter, rather than relying solely on the ongoing-rent shortcut.
- No UI warning/cap on entering a long span in "Monthly rent" mode for one-off logged entries — the root cause (forcing a bounded lump-sum for an unbounded situation) is fixed by giving ongoing rent its own concept instead, making that entry pattern unnecessary rather than guarding against it.
