# P4-03 — Income vs expense over time + balance trend

Status: approved (2026-06-28)
Ticket: P4-03 — Income vs expense over time + balance/trend chart
Phase: 4 — Dashboard & export

## Goal

Two time series for the dashboard charts, built from the user's transactions:

1. **Income vs expense over time** — per month, the income and expense
   magnitudes (and net). Transfers excluded (the P1-06 invariant).
2. **Balance trend** — the cumulative account balance over the same months.
   Transfers **included** (they change a balance), starting from the accounts'
   opening balances — the same treatment as P4-01 `accountBalances`.

Pure aggregation core only this ticket; charts + period granularity selector are
the Phase 4 UI (browser-verified). The two series deliberately differ in transfer
treatment — that is why they are computed separately rather than one cumulating
the other.

## Decisions (locked)

1. **Month buckets are UTC `YYYY-MM`.** `occurred_at` is stored UTC (imported
   rows are UTC midnight, P2-08). Bucketing is `occurred_at.slice(0, 7)` — no
   timezone math, deterministic, and consistent with how the rows were stored.
   Monthly is the v1 granularity; weekly/daily can layer on later.

2. **Per currency, never across** — same discipline as the rest of Phase 4.
   Both series are `Record<currency, …[]>`.

3. **Buckets are sorted ascending by period** and **sparse** (a month with no
   rows produces no bucket — the UI fills gaps if it wants a continuous axis;
   the core does not invent a date range).

4. **`monthlySeries` excludes transfers** (income/expense/net, like the totals
   module). **`balanceTrend` includes every signed amount** and is cumulative
   from `opening` (per currency), so the last point equals the P4-01 balance for
   that currency (consistency check).

## Architecture — `lib/domain/dashboard/over-time.ts`

```ts
export type TimedTxn = {
  amount_cents: number // signed
  currency: string
  is_transfer: boolean
  occurred_at: string // ISO; bucketed by the first 7 chars (YYYY-MM)
}

export interface MonthBucket {
  period: string // YYYY-MM
  income: number
  expense: number // positive magnitude
  net: number // income - expense
}
export interface TrendPoint {
  period: string // YYYY-MM
  balance: number // cumulative, in cents
}

/** Per-currency monthly income/expense/net, transfers excluded, period asc. */
export function monthlySeries(txns: TimedTxn[]): Record<string, MonthBucket[]>

/** Per-currency cumulative balance by month, transfers included, period asc.
 *  `opening` maps currency -> starting balance in cents (default 0). */
export function balanceTrend(
  txns: TimedTxn[],
  opening?: Record<string, number>
): Record<string, TrendPoint[]>
```

## Tests — `lib/domain/dashboard/over-time.test.ts`

- `monthlySeries`: buckets by `YYYY-MM`; income/expense split by sign; net =
  income − expense; transfers excluded; per-currency separation; sorted asc;
  empty → `{}`.
- `balanceTrend`: cumulative across months; transfers **included**; respects the
  `opening` baseline per currency; the final point equals opening + Σ all signed
  amounts for that currency (matches P4-01); sorted asc; empty → `{}`.

## Out of scope

- Charts + granularity (week/day) selector UI → Phase 4 UI (browser).
- Gap-filling a continuous month axis (UI concern).

## Verification

`npm run typecheck`, `npm run lint`, `npm test` green.
