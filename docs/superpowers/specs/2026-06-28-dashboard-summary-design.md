# P4-01 — Dashboard summary: net cash flow, balances, savings rate

Status: approved (2026-06-28)
Ticket: P4-01 — Dashboard: net cash flow, balances, savings rate
Phase: 4 — Dashboard & export

## Goal

The first dashboard tile set needs three figures derived from the user's
accounts + transactions:

1. **Net cash flow** — income, expense, and net over a period.
2. **Balances** — each account's current balance, and a per-currency total.
3. **Savings rate** — what fraction of income was kept (`net / income`).

Per this team's pattern, this ticket ships the **pure, deterministic domain
core** ahead of the manual gate; the dashboard page + data fetch land with the
Phase 4 UI work (P4-04 / browser-verified). No I/O, no React, no FX fetching.

## Decisions (locked)

1. **Net cash flow reuses the P1-06 totals module.** `summarizeByCurrency`
   already computes per-currency `{income, expense, net}` with transfers
   excluded and income/expense as the *sign* of `amount_cents`. The dashboard
   does not re-derive this — it consumes `Totals`.

2. **Balances include transfers; income/expense excludes them.** A transfer
   moves money *through* an account, so it changes that account's balance — it
   must be summed into the balance. This is the deliberate inverse of the totals
   module (which excludes transfers to avoid double-counting income/expense).
   Balance = `opening_balance + Σ amount_cents`.

3. **Balance never sums across currencies (mirrors `summarizeInBase`).** An
   account has one currency. A transaction whose `currency` differs from its
   account's currency would need an FX rate, and the domain never fetches FX. So
   `accountBalances` sums only same-currency rows into the balance and reports a
   `foreignCount` of skipped rows, letting the UI surface "N rows in another
   currency excluded" rather than silently producing a wrong number.

4. **Savings rate is `net / income`, or `null` when income ≤ 0.** With no
   income there is no rate to report (not `0`, not `Infinity`). When expenses
   exceed income the rate is negative (overspending) — a real, meaningful value,
   not clamped. Returned as a unitless ratio (`0.25` = 25%); the UI formats it.

## Architecture — `lib/domain/dashboard/summary.ts`

```ts
export type BalanceAccount = {
  id: string
  currency: string
  opening_balance: number // cents
}
export type BalanceTxn = {
  account_id: string
  amount_cents: number // signed cents
  currency: string
}

export interface AccountBalance {
  accountId: string
  currency: string
  /** opening_balance + signed sum of same-currency txns, in cents. */
  balance: number
  /** Count of txns on this account skipped (currency ≠ account currency). */
  foreignCount: number
}

/** Current balance for each account (transfers included; foreign-currency
 *  rows excluded + counted). Order mirrors the input `accounts`. */
export function accountBalances(
  accounts: BalanceAccount[],
  txns: BalanceTxn[]
): AccountBalance[]

/** Sum of account balances grouped by currency (never across currencies). */
export function totalBalanceByCurrency(
  balances: AccountBalance[]
): Record<string, number>

/** net / income as a ratio, or null when income ≤ 0. */
export function savingsRate(totals: {
  income: number
  expense: number
}): number | null
```

`net` is recomputed inside `savingsRate` as `income - expense` so the caller can
pass either a full `Totals` or the two fields — keeps it decoupled from the
totals shape while staying consistent with it.

## Tests — `lib/domain/dashboard/summary.test.ts`

- `accountBalances`: opening balance with no txns; opening + signed sum (income
  raises, expense lowers); **a transfer row IS included** in the balance;
  a foreign-currency txn is excluded and bumps `foreignCount`; an account with
  no txns keeps its opening balance; output order follows the input.
- `totalBalanceByCurrency`: groups by currency, sums within a currency, never
  merges EUR + USD; empty input → `{}`.
- `savingsRate`: `income 1000 / expense 750` → `0.25`; `expense > income` →
  negative; `income 0` → `null`; negative income guarded → `null`.

## Out of scope

- Dashboard page, tiles, charts, period selector UI → P4-02/03/04 (browser).
- Base-currency consolidation of balances (needs an FX source) → P1-07 follow-up.
- Data fetch (RLS-enforced read of accounts + transactions) → lands with the UI.

## Verification

`npm run typecheck`, `npm run lint`, `npm test` green.
