# Real Estate: Edit Property & Ownership Percentage — Plan

Spec: `docs/superpowers/specs/2026-07-29-real-estate-edit-ownership-design.md`

**Execution mode:** inline, same session as planning. Lean outline per Marc's standing preference — no full-code-per-step, TDD as usual, small commits per task.

## Task 1 — Schema + migration
- Add `ownershipPct` (numeric(5,2), not null, default '100', check 0 < x <= 100) to `properties` in `lib/db/schema/real-estate.ts`.
- Generate migration via project's `db-generate` flow; run `db:migrate`.
- Commit.

## Task 2 — Validation schemas
- Add `ownershipPct` (number, 0 < x <= 100) to `createPropertySchema` and `updatePropertySchema` in `lib/validation/real-estate.ts`.
- Commit.

## Task 3 — Domain metrics scaling
- In `packages/domain/src/real-estate/metrics.ts`: thread ownership scaling through `equityCents`, `outstandingDebtCents`, `costBasisCents`, `roiPct`, `grossYieldPct`, `netYieldPct`, `incomeInRangeCents`, `cashFlowCents`, `aggregatePortfolio`.
- Decide param-vs-row-field for `ownershipPct` at this point, apply consistently across all functions.
- Extend `metrics.test.ts`: one new case per affected function using a 50%-owned property fixture, asserting halved output.
- Run domain test suite, confirm green, commit.

## Task 4 — Data layer wiring
- `app/protected/real-estate/data.ts`: pass `ownershipPct` through `computeMetrics`; scale `getRealEstateEquityByCurrency()` inline (`* ownershipPct/100`) since it bypasses `metrics.ts`.
- Leave `getRentalIncomeEvents()` / `getPropertyExpenseEvents()` raw/unscaled (detail page shows real figures).
- Commit.

## Task 5 — Dashboard scaling
- `app/protected/page.tsx`: confirm net worth + `WealthAllocation` consume already-scaled equity (no double-scaling). Scale the Earnings `__rent__` row at aggregation.
- Manually verify via `run` skill (Marc to confirm rendering — sandbox can't drive a browser).
- Commit.

## Task 6 — Property detail page display
- Add "Your share: {ownershipPct}%" badge near property header.
- Equity stat card shows scaled equity with subtext clarifying it reflects ownership share; other stats (price, value, rent, expenses) stay full/unscaled.
- Commit.

## Task 7 — Ownership % field in PropertyForm
- Add "Ownership %" number input (1–100, default 100) near currency/purchase price in `PropertyForm.tsx`.
- Wire into both create and edit submit payloads.
- Commit.

## Task 8 — Edit dialog wiring
- `PropertyActions.tsx`: add "Edit" button opening a `Dialog` (mirror `SellDialog` structure) rendering `PropertyForm` pre-filled with the property's current values.
- Extend `updateProperty` server action (`app/protected/real-estate/actions.ts`) to persist every field `PropertyForm` exposes (name, type, address, city, currency, purchase price, current value, ownershipPct, notes, isRented, rental dates) — not just the current subset.
- On edit submit, call `updateProperty` instead of `createProperty`.
- Commit.

## Task 9 — End-to-end check
- Run full test suite + typecheck + lint.
- Manually verify (via `run` skill, Marc drives the browser): add a property with ownership 50%, confirm equity/net-worth/rent figures halve, edit an existing property and confirm changes persist.
- Update memory: refresh "Real Estate module state" entry with edit + ownership % now shipped.
