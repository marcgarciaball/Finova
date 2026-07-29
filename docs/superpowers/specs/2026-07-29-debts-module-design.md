# Debts Module: Loans, Credit Cards & Net Worth Breakdown

## Problem

The only debt Finova tracks today is `propertyLoans`, embedded inside the Real Estate module and tied to a specific property. There's no way to record a car loan, personal loan, or credit card balance, and the dashboard has no clean "assets vs debts" view — net worth is a single blended number with real estate debt silently netted out as equity.

## Data model

Replace `propertyLoans` with a generic `debts` table (`lib/db/schema/debts.ts`), migration `0029_add_debts_table.sql`:

```
debts
├─ id, user_id
├─ type: mortgage | car_loan | personal_loan | credit_card | other
├─ property_id (nullable FK → properties; only set when type = mortgage)
├─ lender (text)
├─ currency_code
├─ principal_cents        -- original amount borrowed
├─ interest_rate_pct
├─ rate_type: fixed | variable | mixed
├─ term_months
├─ start_date
├─ payment_cents           -- fixed monthly payment
├─ outstanding_cents        -- manually-maintained current balance (source of truth)
├─ status: active | paid_off | defaulted
├─ notes
├─ created_at / updated_at
```

RLS policies mirror the owner-scoped pattern used by `properties`/`manual_assets`. The migration copies existing `property_loans` rows into `debts` (`type = 'mortgage'`, carrying `property_id`, `outstandingCents`, and the equivalent fields across), then drops `property_loans`.

`outstanding_cents` is the manually-maintained real balance — the same pattern as today's `propertyLoans.outstandingCents` and Manual Assets' `currentValueCents`, since real loans drift from a textbook schedule (rate changes, extra payments, fee adjustments) and there's no way to hand-correct a pure formula. `principal_cents`, `interest_rate_pct`, `term_months`, `start_date`, and `payment_cents` are used only to project a reference amortization schedule and payoff date — never to overwrite `outstanding_cents`.

`lib/validation/debts.ts`: `debtRowSchema`, `createDebtSchema`, `updateDebtSchema` (mirrors `lib/validation/real-estate.ts` loan schemas), with `property_id` required only when `type = 'mortgage'`.

## Domain metrics (`packages/domain/src/debts/metrics.ts`)

Pure, unit-tested functions generalizing the amortization math currently in `real-estate/metrics.ts`:

- `projectedBalanceCents(debt, asOfDate)` — reference-only remaining principal at a given date per the textbook schedule (for the schedule table / projection chart, NOT the balance used in totals).
- `nextPaymentDate(debt, asOfDate)` / `payoffDate(debt)` — also schedule-projections.
- `aggregateDebts(debts)` — totals by currency and by type using each debt's real `outstandingCents`, returning the same `CurrencyTotals` shape used elsewhere in the codebase.

`real-estate/metrics.ts`'s `outstandingDebtCents`/`ltvPct`/`equityCents` continue to use the row's `outstandingCents` directly (unchanged behavior), now reading from `debts` instead of `propertyLoans`.

## Data & actions layer

- `app/protected/debts/data.ts` — RLS-scoped Supabase read queries (list debts, single debt, aggregates), following the `real-estate/data.ts` pattern.
- `app/protected/debts/actions.ts` — `'use server'` create/update/delete mutations.
- `app/protected/real-estate/[id]/LoansTable.tsx` and `LoanRowActions.tsx` are updated to read/write `debts` filtered by `property_id` instead of `propertyLoans` — mortgage management still happens from the property detail page with no UX change there.

## New Debts page (`app/protected/debts/`)

- `page.tsx` — list of all debts across types, "Load more" button (not numbered pagination), create-debt form/modal.
- `DebtsOverview.tsx` — summary cards: total debt by currency, breakdown by type (`components/charts/DonutChart.tsx`), total monthly payment obligation.
- `[id]/page.tsx` — single debt detail: real outstanding balance (editable, like a manual asset), plus a projected amortization schedule table (payment #, date, principal/interest split, projected remaining balance) computed via the domain function, and projected payoff date — labeled as a projection, since it can diverge from the real balance above.
- Standalone debts (car loan, personal loan, credit card, freestanding mortgage) are created here; mortgages can also carry a `property_id` set from this page's form (property picker) or implicitly via the property detail page — both paths write to the same table.

## Dashboard integration (`app/protected/page.tsx`)

- New `NetWorthCard` component: Total Assets, Total Debts, Net Worth, Debt/Asset ratio.
- `app/protected/data.ts` gains `getDebtsSummary()` (aggregates all debt types by currency via `aggregateDebts`), called alongside the existing investments/real-estate/manual-assets aggregation calls (~`page.tsx` lines 255-290).
- Real estate equity keeps its current meaning (property value − its linked mortgage debt) but sources the debt figure from `debts` instead of `propertyLoans`; total assets for the new card sum cash + investments + real estate value (unscaled by debt) + manual assets, and total debts sum all `debts` rows including mortgages — so mortgage debt isn't double-counted (it's subtracted once, inside the Net Worth card's own Total Assets − Total Debts, not also pre-netted into a "real estate equity" line item feeding the same card).

## Testing

- `packages/domain/src/debts/metrics.test.ts` — amortization formula correctness (standard cases, edge cases: final payment rounding, zero-interest, single-payment term).
- `tests/rls/debts.rls.test.ts` — owner-scoped access, mirroring `tests/rls/real-estate.rls.test.ts`.
- Real estate loan tests updated to point at `debts` instead of `propertyLoans`.

## Out of scope

- No payment history / ledger of actual payments made — balance is purely schedule-computed, not reconciled against real transactions.
- No linking a debt's monthly payment to an actual bank transaction/category for cash-flow tracking.
- No support for irregular payment schedules (skipped payments, extra principal, refinancing mid-term) — a refinance is modeled as closing one debt (`status = paid_off`) and creating a new one.
- No multi-borrower/co-signer tracking, analogous to how Real Estate's ownership % has no co-owner list.
