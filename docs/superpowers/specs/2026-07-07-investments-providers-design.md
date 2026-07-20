# Investments provider layer — design (Inversiones, slice A3)

**Date:** 2026-07-07
**Source:** Inversiones build prompt + module brainstorm (2026-07-06); Finnhub docs https://finnhub.io/docs/api
**Status:** Approved by Marc (design summary), spec for the record

## Goal

Server-only HTTP clients for market data: latest quotes and symbol search
(Finnhub for stock/etf/fund, CoinGecko for crypto), profile enrichment for
asset normalization, and daily FX rates (Frankfurter). Pure translation layer:
raw provider JSON → validated, cents-based domain shapes. No caching, no DB
writes, no rate limiting here — the A5 job owns batching/rate limits and the
keep-stale-cache policy; A4 owns the asset upsert.

## Non-goals

- `getHistory` / `getDividends` — Finnhub free tier dropped `/stock/candle`
  and `/stock/dividend2`; Phases C/D pick a viable source. The interface omits
  them entirely (adding a method later is cheap; stubbing one that 403s is a
  trap).
- No retries/backoff (A5 job concern), no request coalescing, no persistence.

## Architecture

```
lib/investments/providers/
  types.ts       Quote, SymbolResult, AssetProfile, PriceProvider, ProviderError
  finnhub.ts     getQuote, searchSymbol, getStockProfile (profile2)
  coingecko.ts   getQuote (simple/price), searchSymbol (/search)
  fx.ts          fetchDailyRates (Frankfurter /latest)
  index.ts       routing: stock|etf|fund → finnhub; crypto → coingecko
```

I/O code, so it lives outside `lib/domain`. Every client takes an injectable
`fetchImpl: typeof fetch` (defaults to global fetch) — the sandbox cannot
reach these hosts, so unit tests stub fetch; live smoke is a human step.

### types.ts

```ts
interface Quote {
  priceCents: number      // integer, converted at the boundary
  currency: string        // ISO 4217; see per-provider notes
  quoteType: QuoteType    // 'live' | 'eod' (A3 emits only these two)
  fetchedAt: string       // ISO timestamp (provider t when present, else now)
}

interface SymbolResult {
  assetType: AssetType
  ticker: string
  name: string
  exchange: string | null    // Finnhub /search does NOT return it
  currency: string | null    // nor this — enrich via getStockProfile on select
  isin: string | null
  coingeckoId: string | null // set for crypto results
}

interface AssetProfile {     // /stock/profile2 subset for asset normalization
  ticker: string
  name: string
  exchange: string | null
  currency: string | null
  isin: string | null        // profile2 rarely has it; null-safe
  raw: Record<string, unknown>  // stored into assets.provider_meta
}

interface PriceProvider {
  getQuote(asset: QuoteTarget): Promise<Quote>
  searchSymbol(query: string): Promise<SymbolResult[]>
}

interface QuoteTarget {      // the asset fields quoting needs
  type: AssetType
  ticker: string | null
  coingeckoId: string | null
  currency: string           // asset's native currency
}

class ProviderError extends Error {
  provider: 'finnhub' | 'coingecko' | 'frankfurter'
  kind: 'http' | 'malformed' | 'not_found' | 'missing_key'
  status?: number
}
```

### finnhub.ts

Base `https://finnhub.io/api/v1`; key from `opts.apiKey ??
process.env.FINNHUB_API_KEY` (`missing_key` ProviderError when unset).
`FINNHUB_API_KEY` is also added to `serverEnvSchema` for documentation, but
the clients must NOT import `env.server` — its `server-only` import is a
Next-compiler-provided module that vitest cannot resolve, and these clients
need unit tests. They are kept server-side by usage (only server actions /
route handlers import them), same posture as the A5 job code.

- `GET /quote?symbol=X` → `{ c, d, dp, h, l, o, pc, t }` (floats, major
  units). `c === 0 && t === 0` means unknown symbol → `not_found`.
  `priceCents = Math.round(c * 100)`. **`/quote` carries no currency** — the
  quote inherits `target.currency` (documented router contract).
  `quoteType`: `'live'` (Finnhub free tier serves real-time US data; market
  session detection is deliberately out of scope until A5 needs it).
- `GET /search?q=…` → `{ count, result: [{ description, displaySymbol,
  symbol, type }] }`. Map `type` ("Common Stock" → `stock`, "ETP"/"ETF" →
  `etf`, "Mutual Fund"/"Open-End Fund" → `fund`, anything else → `stock`).
  `exchange`/`currency`/`isin` are `null` here.
- `GET /stock/profile2?symbol=X` → `{ currency, exchange, name, ticker, … }`;
  empty object (`{}`) for unknown/uncovered symbols → `not_found`. Feeds the
  A4 asset upsert (currency + exchange + provider_meta).

### coingecko.ts

Base `https://api.coingecko.com/api/v3`, no key.

- `GET /simple/price?ids=<id>&vs_currencies=<ccy>` →
  `{ "<id>": { "<ccy>": 91234.56 } }`. vs_currency = lowercased
  `target.currency` (the currency chosen when the asset was added; A4 defaults
  it to the user's base currency). Missing id key → `not_found`.
  `quoteType: 'live'` (24/7 market).
- `GET /search?query=…` → `{ coins: [{ id, name, symbol, … }] }` →
  `SymbolResult` with `assetType: 'crypto'`, `ticker` = uppercased symbol,
  `coingeckoId` = id, `exchange`/`isin`/`currency` null.

### fx.ts

Frankfurter `GET https://api.frankfurter.app/latest?from=<base>&to=A,B,C` →
`{ base, date, rates: { EUR: 0.85, … } }`.

```ts
interface DailyFxRates {
  rateDate: string                 // provider's `date` (ECB business day)
  rates: { fromCcy: string; toCcy: string; rate: number }[]
}
fetchDailyRates(from: string, to: string[], fetchImpl?): Promise<DailyFxRates>
```

Rows shaped for direct upsert into `fx_rates` by the A5 daily job.

### index.ts

```ts
getQuote(target: QuoteTarget, fetchImpl?): Promise<Quote>       // routes by type
searchSymbol(query: string, assetType: AssetType, fetchImpl?): Promise<SymbolResult[]>
```

`stock | etf | fund` → finnhub (fund coverage on Finnhub free is thin — a
known risk, `not_found` surfaces honestly); `crypto` → coingecko. Quoting a
listed asset without a ticker, or a crypto without a coingeckoId, throws
`malformed` — the DB can't guarantee those invariants per-type.

## Error handling

Every non-2xx response → `ProviderError('http', status)`. Every payload is
zod-parsed (schemas private to each client); mismatch → `malformed`. No
partial results: a malformed search item is dropped, a malformed quote throws.
Callers decide policy (A5: keep stale cache + log; A4: surface a form error).

## Testing

Mocked-fetch Vitest suites per client (`vi.fn()` returning `Response.json`
stubs): happy path incl. cents conversion and rounding, HTTP error → `http`,
garbage payload → `malformed`, Finnhub zero-quote and empty-profile →
`not_found`, missing key → `missing_key`, router dispatch + invariant errors,
Frankfurter row shaping. No live network anywhere; human smoke happens when
A4/A5 wire the clients up.

## Definition of done

- All five modules implemented; `FINNHUB_API_KEY` in `serverEnvSchema`.
- Suites green: `npm run test && npm run typecheck && npm run lint`.
- No UI/DB changes.
