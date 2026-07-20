# Investments add-transaction UI — design (Inversiones, slice A4)

**Date:** 2026-07-07 · **Status:** lean spec (inline execution, per Marc's token rule)

## Goal

First user-visible slice: an **Inversiones** top-level nav tab at
`/protected/investments` where the user searches an asset, records buy/sell
transactions, and sees the transaction log. Holdings table/KPIs are Phase B.

## Scope decisions

- **Default portfolio bootstrap:** `getOrCreatePortfolio()` — reads the own
  `portfolios` row, creates one on first visit (name "My Portfolio",
  `base_currency` from `profiles.base_currency`). User client; RLS
  `portfolios_insert_own` allows it.
- **Asset resolution is a two-step server-action flow:**
  1. `searchAssets(query, assetType)` — `assets` table first (ilike on
     ticker/name, same type); if no local hit, provider `searchSymbol`.
     Returns `AssetOption[]` (includes `assetId` when already known).
  2. `resolveAsset(option)` — for provider results: listed assets get
     currency/exchange/provider_meta from `getFinnhubStockProfile` (fallback
     when profile is `not_found`: currency = portfolio base, exchange null);
     crypto gets currency = portfolio base. Upserts into `assets` via the
     **admin client** (`onConflict` ticker+exchange / coingecko_id) and
     returns `{ id, currency, name, ticker, type }` so the form can default
     the price currency before submit.
- **`addInvestmentTransaction` server action:** requireUser → zod input
  schema → **oversell guard for sells** (loads the asset's own txns, runs the
  A2 `computeHolding`, rejects if the new sell exceeds the held quantity) →
  insert with `user_id: claims.sub` → revalidate the page. Money parses via
  the money module (`fromDecimal`), quantity validated ≤ 8 dp.
- **Deferred (YAGNI for this slice):** `investment_accounts` broker select
  (column stays null; needs its own CRUD slice), edit/delete + audit UI
  (Phase D), holdings display (Phase B).

## Files

- `lib/validation/investment-transaction.ts` (+test) — input schema
  `createInvestmentTransactionSchema` (assetId uuid, type buy|sell, decimal
  strings for quantity/price/fees, tradedAt ≤ today, notes ≤ 500) +
  `parseQuantity` (8-dp guard).
- `app/protected/investments/data.ts` — `getOrCreatePortfolio`,
  `listInvestmentTransactions` (PostgREST embed of `assets(name, ticker,
  type)` for display).
- `app/protected/investments/actions.ts` — the three actions above,
  `ActionResult` pattern.
- `app/protected/investments/AddTransactionPanel.tsx` (client) — search box →
  result list → on-select `resolveAsset` → `InvestmentTransactionForm` with
  injected actions (jsdom-testable, ProfileForm pattern).
- `app/protected/investments/InvestmentTransactionForm.tsx` (+test) — type
  toggle, date (default today), quantity, price + currency, fees, notes;
  `useActionState`, inline field errors incl. `oversell`.
- `app/protected/investments/transaction-list.tsx` + `page.tsx` — log table +
  empty state.
- `app/protected/layout.tsx` — nav link; `messages/{en,es}.json` —
  `investments` namespace.

## Testing

Validation schema unit tests; form component test with stubbed action (fields
render, submit payload, inline error). Data/actions are thin composition →
typecheck + Marc's browser pass (sandbox: no DB/network/server). Live provider
smoke happens here too — first real Finnhub/CoinGecko calls.
