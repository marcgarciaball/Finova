# Investments Provider Layer (A3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Server-side market-data clients — Finnhub (quote/search/profile), CoinGecko (quote/search), Frankfurter (daily FX) — behind a provider-agnostic router, fully unit-tested with mocked fetch.

**Architecture:** Pure translation layer in `lib/investments/providers/`: raw provider JSON → zod-validated, cents-based domain shapes. Typed `ProviderError` for every failure; no caching, retries, DB writes, or rate limiting (A5's job). Injectable `fetchImpl` everywhere because the sandbox has no network access to these hosts.

**Tech Stack:** zod v4, global fetch, Vitest.

**Design spec:** `docs/superpowers/specs/2026-07-07-investments-providers-design.md`

## Global Constraints

- npm + Biome (sorted interface members enforced); gate: `npm run test && npm run typecheck && npm run lint`.
- Money integer cents: provider floats convert via `Math.round(price * 100)` at the boundary, nowhere else.
- Do NOT import `server-only` or `@/lib/validation/env.server` in provider modules — vitest cannot resolve `server-only`. API key comes from `opts.apiKey ?? process.env.FINNHUB_API_KEY`.
- No live network calls in tests; every test stubs `fetchImpl`.
- No `getHistory`/`getDividends` anywhere (Finnhub free tier lost them; Phases C/D).

---

### Task 1: Provider types + env documentation

**Files:**
- Create: `lib/investments/providers/types.ts`
- Modify: `lib/validation/env.server.ts` (add optional `FINNHUB_API_KEY`)

**Interfaces:**
- Consumes: `AssetType`, `QuoteType` from `@/lib/domain/investments/types`.
- Produces (used by Tasks 2–5): `Quote`, `SymbolResult`, `AssetProfile`, `QuoteTarget`, `PriceProvider`, `ProviderError` (with `provider: ProviderName`, `kind: ProviderErrorKind`, `status?: number`).

- [ ] **Step 1: Create `lib/investments/providers/types.ts`**

```ts
import type { AssetType, QuoteType } from '@/lib/domain/investments/types'

/**
 * Provider-agnostic market-data shapes (Inversiones A3). Everything crossing
 * this boundary is already validated and cents-based; raw provider payloads
 * never leak past the clients. History/dividends are deliberately absent —
 * Finnhub's free tier no longer serves them (Phases C/D pick a source).
 */

export interface Quote {
  currency: string // ISO 4217 — Finnhub /quote carries none; inherited from the asset
  fetchedAt: string // ISO timestamp
  priceCents: number // integer, converted at the boundary
  quoteType: QuoteType // A3 emits 'live' only; A5 downgrades on staleness
}

export interface SymbolResult {
  assetType: AssetType
  coingeckoId: string | null // set for crypto results
  currency: string | null // Finnhub /search returns neither currency…
  exchange: string | null // …nor exchange — enrich via getFinnhubStockProfile
  isin: string | null
  name: string
  ticker: string
}

/** /stock/profile2 subset used by the A4 asset upsert. */
export interface AssetProfile {
  currency: string | null
  exchange: string | null
  isin: string | null
  name: string
  raw: Record<string, unknown> // stored into assets.provider_meta
  ticker: string
}

/** The asset fields quoting needs (a projection of an `assets` row). */
export interface QuoteTarget {
  coingeckoId: string | null
  currency: string // asset's native currency
  ticker: string | null
  type: AssetType
}

export interface PriceProvider {
  getQuote(target: QuoteTarget): Promise<Quote>
  searchSymbol(query: string): Promise<SymbolResult[]>
}

export type ProviderName = 'finnhub' | 'coingecko' | 'frankfurter'
export type ProviderErrorKind = 'http' | 'malformed' | 'not_found' | 'missing_key'

export class ProviderError extends Error {
  constructor(
    readonly provider: ProviderName,
    readonly kind: ProviderErrorKind,
    readonly status?: number
  ) {
    super(`${provider}: ${kind}${status === undefined ? '' : ` (${status})`}`)
    this.name = 'ProviderError'
  }
}
```

- [ ] **Step 2: Add the key to `lib/validation/env.server.ts`**

Inside `serverEnvSchema`, after `SUPABASE_SERVICE_ROLE_KEY`:

```ts
  FINNHUB_API_KEY: z.string().min(1).optional(),
```

- [ ] **Step 3: Verify and commit**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add lib/investments/providers/types.ts lib/validation/env.server.ts
git commit -m "feat(investments): provider-layer types + FINNHUB_API_KEY env"
```

---

### Task 2: Finnhub client

**Files:**
- Create: `lib/investments/providers/finnhub.ts`
- Test: `lib/investments/providers/finnhub.test.ts`

**Interfaces:**
- Consumes: Task 1 types.
- Produces: `getFinnhubQuote(target: QuoteTarget, opts?: FinnhubOpts): Promise<Quote>`, `searchFinnhubSymbols(query: string, opts?: FinnhubOpts): Promise<SymbolResult[]>`, `getFinnhubStockProfile(ticker: string, opts?: FinnhubOpts): Promise<AssetProfile>` where `interface FinnhubOpts { apiKey?: string; fetchImpl?: typeof fetch }`.

- [ ] **Step 1: Write the failing tests**

Create `lib/investments/providers/finnhub.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import {
  getFinnhubQuote,
  getFinnhubStockProfile,
  searchFinnhubSymbols,
} from './finnhub'
import { ProviderError, type QuoteTarget } from './types'

const jsonRes = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response

const stub = (body: unknown, status = 200) =>
  vi.fn(async () => jsonRes(body, status)) as unknown as typeof fetch

const target: QuoteTarget = {
  coingeckoId: null,
  currency: 'USD',
  ticker: 'AAPL',
  type: 'stock',
}

const opts = (fetchImpl: typeof fetch) => ({ apiKey: 'k', fetchImpl })

describe('getFinnhubQuote', () => {
  it('converts the float quote to integer cents', async () => {
    const fetchImpl = stub({ c: 261.74, t: 1750000000 })
    const q = await getFinnhubQuote(target, opts(fetchImpl))
    expect(q.priceCents).toBe(26174)
    expect(q.currency).toBe('USD') // inherited from the target
    expect(q.quoteType).toBe('live')
    expect(q.fetchedAt).toBe(new Date(1750000000 * 1000).toISOString())
  })

  it('requests the symbol with the key', async () => {
    const fetchImpl = stub({ c: 1, t: 1 })
    await getFinnhubQuote(target, opts(fetchImpl))
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as string
    expect(url).toContain('/quote?symbol=AAPL')
    expect(url).toContain('token=k')
  })

  it('maps the zero quote to not_found', async () => {
    const fetchImpl = stub({ c: 0, d: null, t: 0 })
    await expect(getFinnhubQuote(target, opts(fetchImpl))).rejects.toMatchObject(
      { kind: 'not_found', provider: 'finnhub' }
    )
  })

  it('maps HTTP errors', async () => {
    const fetchImpl = stub({}, 429)
    await expect(getFinnhubQuote(target, opts(fetchImpl))).rejects.toMatchObject(
      { kind: 'http', status: 429 }
    )
  })

  it('maps malformed payloads', async () => {
    const fetchImpl = stub({ price: 'nope' })
    await expect(getFinnhubQuote(target, opts(fetchImpl))).rejects.toMatchObject(
      { kind: 'malformed' }
    )
  })

  it('throws missing_key without a key', async () => {
    vi.stubEnv('FINNHUB_API_KEY', '')
    await expect(
      getFinnhubQuote(target, { fetchImpl: stub({ c: 1, t: 1 }) })
    ).rejects.toMatchObject({ kind: 'missing_key' })
    vi.unstubAllEnvs()
  })

  it('throws malformed for a target without a ticker', async () => {
    await expect(
      getFinnhubQuote({ ...target, ticker: null }, opts(stub({ c: 1, t: 1 })))
    ).rejects.toBeInstanceOf(ProviderError)
  })
})

describe('searchFinnhubSymbols', () => {
  it('maps result items and asset types', async () => {
    const fetchImpl = stub({
      count: 3,
      result: [
        { description: 'APPLE INC', displaySymbol: 'AAPL', symbol: 'AAPL', type: 'Common Stock' },
        { description: 'VANGUARD SP500', displaySymbol: 'VUSA.L', symbol: 'VUSA.L', type: 'ETP' },
        { description: 'SOME FUND', displaySymbol: 'FUNDX', symbol: 'FUNDX', type: 'Open-End Fund' },
      ],
    })
    const results = await searchFinnhubSymbols('apple', opts(fetchImpl))
    expect(results).toHaveLength(3)
    expect(results[0]).toEqual({
      assetType: 'stock',
      coingeckoId: null,
      currency: null,
      exchange: null,
      isin: null,
      name: 'APPLE INC',
      ticker: 'AAPL',
    })
    expect(results[1]?.assetType).toBe('etf')
    expect(results[2]?.assetType).toBe('fund')
  })

  it('drops malformed items instead of failing the search', async () => {
    const fetchImpl = stub({
      count: 2,
      result: [{ bogus: true }, { description: 'OK', symbol: 'OK', type: '' }],
    })
    const results = await searchFinnhubSymbols('ok', opts(fetchImpl))
    expect(results).toHaveLength(1)
    expect(results[0]?.ticker).toBe('OK')
  })
})

describe('getFinnhubStockProfile', () => {
  it('maps profile2 fields and keeps the raw payload', async () => {
    const body = {
      currency: 'USD',
      exchange: 'NASDAQ NMS - GLOBAL MARKET',
      name: 'Apple Inc',
      ticker: 'AAPL',
      weburl: 'https://www.apple.com/',
    }
    const p = await getFinnhubStockProfile('AAPL', opts(stub(body)))
    expect(p.currency).toBe('USD')
    expect(p.exchange).toContain('NASDAQ')
    expect(p.isin).toBeNull()
    expect(p.raw).toEqual(body)
  })

  it('maps the empty profile to not_found', async () => {
    await expect(
      getFinnhubStockProfile('NOPE', opts(stub({})))
    ).rejects.toMatchObject({ kind: 'not_found' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/investments/providers/finnhub.test.ts`
Expected: FAIL — cannot resolve `./finnhub`.

- [ ] **Step 3: Implement `lib/investments/providers/finnhub.ts`**

```ts
import { z } from 'zod'
import type { AssetType } from '@/lib/domain/investments/types'
import {
  type AssetProfile,
  ProviderError,
  type Quote,
  type QuoteTarget,
  type SymbolResult,
} from './types'

/**
 * Finnhub client (Inversiones A3) — stocks/ETFs/funds. Free-tier endpoints
 * only: /quote, /search, /stock/profile2 (candles and dividends went paid in
 * 2023 and are deliberately not wrapped). /quote returns floats in major
 * units and NO currency — the quote inherits the asset's stored currency.
 */

const BASE_URL = 'https://finnhub.io/api/v1'

export interface FinnhubOpts {
  apiKey?: string
  fetchImpl?: typeof fetch
}

function resolveKey(opts: FinnhubOpts): string {
  const key = opts.apiKey ?? process.env.FINNHUB_API_KEY
  if (!key) {
    throw new ProviderError('finnhub', 'missing_key')
  }
  return key
}

async function getJson(
  path: string,
  opts: FinnhubOpts
): Promise<unknown> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetchImpl(
    `${BASE_URL}${path}${sep}token=${resolveKey(opts)}`
  )
  if (!res.ok) {
    throw new ProviderError('finnhub', 'http', res.status)
  }
  return res.json()
}

const quoteSchema = z.object({ c: z.number(), t: z.number() })

export async function getFinnhubQuote(
  target: QuoteTarget,
  opts: FinnhubOpts = {}
): Promise<Quote> {
  if (!target.ticker) {
    throw new ProviderError('finnhub', 'malformed')
  }
  const raw = await getJson(
    `/quote?symbol=${encodeURIComponent(target.ticker)}`,
    opts
  )
  const parsed = quoteSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ProviderError('finnhub', 'malformed')
  }
  const { c, t } = parsed.data
  if (c === 0 && t === 0) {
    throw new ProviderError('finnhub', 'not_found')
  }
  return {
    currency: target.currency,
    fetchedAt: new Date(t * 1000).toISOString(),
    priceCents: Math.round(c * 100),
    quoteType: 'live',
  }
}

const searchSchema = z.object({ result: z.array(z.unknown()) })
const searchItemSchema = z.object({
  description: z.string(),
  symbol: z.string(),
  type: z.string().default(''),
})

function mapFinnhubType(type: string): AssetType {
  const v = type.toLowerCase()
  if (v === 'etp' || v.includes('etf')) {
    return 'etf'
  }
  if (v.includes('fund')) {
    return 'fund'
  }
  return 'stock'
}

export async function searchFinnhubSymbols(
  query: string,
  opts: FinnhubOpts = {}
): Promise<SymbolResult[]> {
  const raw = await getJson(`/search?q=${encodeURIComponent(query)}`, opts)
  const parsed = searchSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ProviderError('finnhub', 'malformed')
  }
  const results: SymbolResult[] = []
  for (const item of parsed.data.result) {
    const p = searchItemSchema.safeParse(item)
    if (!p.success) {
      continue // drop malformed items, keep the rest of the search usable
    }
    results.push({
      assetType: mapFinnhubType(p.data.type),
      coingeckoId: null,
      currency: null, // /search carries neither currency nor exchange
      exchange: null,
      isin: null,
      name: p.data.description,
      ticker: p.data.symbol,
    })
  }
  return results
}

const profileSchema = z.object({
  currency: z.string().optional(),
  exchange: z.string().optional(),
  isin: z.string().optional(),
  name: z.string().optional(),
  ticker: z.string().optional(),
})

export async function getFinnhubStockProfile(
  ticker: string,
  opts: FinnhubOpts = {}
): Promise<AssetProfile> {
  const raw = await getJson(
    `/stock/profile2?symbol=${encodeURIComponent(ticker)}`,
    opts
  )
  if (typeof raw !== 'object' || raw === null) {
    throw new ProviderError('finnhub', 'malformed')
  }
  if (Object.keys(raw).length === 0) {
    throw new ProviderError('finnhub', 'not_found') // unknown/uncovered symbol
  }
  const parsed = profileSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ProviderError('finnhub', 'malformed')
  }
  return {
    currency: parsed.data.currency ?? null,
    exchange: parsed.data.exchange ?? null,
    isin: parsed.data.isin ?? null,
    name: parsed.data.name ?? ticker,
    raw: raw as Record<string, unknown>,
    ticker: parsed.data.ticker ?? ticker,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/investments/providers/finnhub.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/investments/providers/finnhub.ts lib/investments/providers/finnhub.test.ts
git commit -m "feat(investments): finnhub quote/search/profile client"
```

---

### Task 3: CoinGecko client

**Files:**
- Create: `lib/investments/providers/coingecko.ts`
- Test: `lib/investments/providers/coingecko.test.ts`

**Interfaces:**
- Consumes: Task 1 types.
- Produces: `getCoinGeckoQuote(target: QuoteTarget, opts?: CoinGeckoOpts): Promise<Quote>`, `searchCoinGeckoSymbols(query: string, opts?: CoinGeckoOpts): Promise<SymbolResult[]>` where `interface CoinGeckoOpts { fetchImpl?: typeof fetch }` (no key needed).

- [ ] **Step 1: Write the failing tests**

Create `lib/investments/providers/coingecko.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { getCoinGeckoQuote, searchCoinGeckoSymbols } from './coingecko'
import type { QuoteTarget } from './types'

const jsonRes = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response

const stub = (body: unknown, status = 200) =>
  vi.fn(async () => jsonRes(body, status)) as unknown as typeof fetch

const target: QuoteTarget = {
  coingeckoId: 'bitcoin',
  currency: 'EUR',
  ticker: 'BTC',
  type: 'crypto',
}

describe('getCoinGeckoQuote', () => {
  it('reads the price for the asset currency and converts to cents', async () => {
    const fetchImpl = stub({ bitcoin: { eur: 91234.567 } })
    const q = await getCoinGeckoQuote(target, { fetchImpl })
    expect(q.priceCents).toBe(9123457)
    expect(q.currency).toBe('EUR')
    expect(q.quoteType).toBe('live')
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as string
    expect(url).toContain('ids=bitcoin')
    expect(url).toContain('vs_currencies=eur')
  })

  it('maps a missing coin to not_found', async () => {
    const fetchImpl = stub({})
    await expect(
      getCoinGeckoQuote(target, { fetchImpl })
    ).rejects.toMatchObject({ kind: 'not_found', provider: 'coingecko' })
  })

  it('maps HTTP errors', async () => {
    const fetchImpl = stub({}, 500)
    await expect(
      getCoinGeckoQuote(target, { fetchImpl })
    ).rejects.toMatchObject({ kind: 'http', status: 500 })
  })

  it('throws malformed for a target without a coingecko id', async () => {
    await expect(
      getCoinGeckoQuote(
        { ...target, coingeckoId: null },
        { fetchImpl: stub({}) }
      )
    ).rejects.toMatchObject({ kind: 'malformed' })
  })
})

describe('searchCoinGeckoSymbols', () => {
  it('maps coins to crypto symbol results', async () => {
    const fetchImpl = stub({
      coins: [
        { id: 'bitcoin', market_cap_rank: 1, name: 'Bitcoin', symbol: 'btc' },
      ],
    })
    const results = await searchCoinGeckoSymbols('bitcoin', { fetchImpl })
    expect(results).toEqual([
      {
        assetType: 'crypto',
        coingeckoId: 'bitcoin',
        currency: null,
        exchange: null,
        isin: null,
        name: 'Bitcoin',
        ticker: 'BTC',
      },
    ])
  })

  it('drops malformed coins', async () => {
    const fetchImpl = stub({
      coins: [{ nope: 1 }, { id: 'ethereum', name: 'Ethereum', symbol: 'eth' }],
    })
    const results = await searchCoinGeckoSymbols('eth', { fetchImpl })
    expect(results).toHaveLength(1)
    expect(results[0]?.coingeckoId).toBe('ethereum')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/investments/providers/coingecko.test.ts`
Expected: FAIL — cannot resolve `./coingecko`.

- [ ] **Step 3: Implement `lib/investments/providers/coingecko.ts`**

```ts
import { z } from 'zod'
import {
  ProviderError,
  type Quote,
  type QuoteTarget,
  type SymbolResult,
} from './types'

/**
 * CoinGecko client (Inversiones A3) — crypto. Keyless free endpoints.
 * /simple/price quotes in the vs_currency we ask for, so the asset's stored
 * currency drives the request; `ids` accepts comma-separated values, which
 * A5 will use for batching.
 */

const BASE_URL = 'https://api.coingecko.com/api/v3'

export interface CoinGeckoOpts {
  fetchImpl?: typeof fetch
}

async function getJson(path: string, opts: CoinGeckoOpts): Promise<unknown> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const res = await fetchImpl(`${BASE_URL}${path}`)
  if (!res.ok) {
    throw new ProviderError('coingecko', 'http', res.status)
  }
  return res.json()
}

const priceSchema = z.record(z.string(), z.record(z.string(), z.number()))

export async function getCoinGeckoQuote(
  target: QuoteTarget,
  opts: CoinGeckoOpts = {}
): Promise<Quote> {
  if (!target.coingeckoId) {
    throw new ProviderError('coingecko', 'malformed')
  }
  const vs = target.currency.toLowerCase()
  const raw = await getJson(
    `/simple/price?ids=${encodeURIComponent(target.coingeckoId)}&vs_currencies=${vs}`,
    opts
  )
  const parsed = priceSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ProviderError('coingecko', 'malformed')
  }
  const price = parsed.data[target.coingeckoId]?.[vs]
  if (price === undefined) {
    throw new ProviderError('coingecko', 'not_found')
  }
  return {
    currency: target.currency,
    fetchedAt: new Date().toISOString(),
    priceCents: Math.round(price * 100),
    quoteType: 'live', // 24/7 market
  }
}

const searchSchema = z.object({ coins: z.array(z.unknown()) })
const coinSchema = z.object({
  id: z.string(),
  name: z.string(),
  symbol: z.string(),
})

export async function searchCoinGeckoSymbols(
  query: string,
  opts: CoinGeckoOpts = {}
): Promise<SymbolResult[]> {
  const raw = await getJson(`/search?query=${encodeURIComponent(query)}`, opts)
  const parsed = searchSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ProviderError('coingecko', 'malformed')
  }
  const results: SymbolResult[] = []
  for (const item of parsed.data.coins) {
    const p = coinSchema.safeParse(item)
    if (!p.success) {
      continue // drop malformed coins, keep the rest of the search usable
    }
    results.push({
      assetType: 'crypto',
      coingeckoId: p.data.id,
      currency: null,
      exchange: null,
      isin: null,
      name: p.data.name,
      ticker: p.data.symbol.toUpperCase(),
    })
  }
  return results
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/investments/providers/coingecko.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/investments/providers/coingecko.ts lib/investments/providers/coingecko.test.ts
git commit -m "feat(investments): coingecko quote/search client"
```

---

### Task 4: Frankfurter FX client

**Files:**
- Create: `lib/investments/providers/fx.ts`
- Test: `lib/investments/providers/fx.test.ts`

**Interfaces:**
- Consumes: Task 1 `ProviderError`.
- Produces: `fetchDailyRates(from: string, to: string[], opts?: { fetchImpl?: typeof fetch }): Promise<DailyFxRates>` with `interface DailyFxRates { rateDate: string; rates: { fromCcy: string; rate: number; toCcy: string }[] }` — rows shaped for the A5 daily upsert into `fx_rates`.

- [ ] **Step 1: Write the failing tests**

Create `lib/investments/providers/fx.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { fetchDailyRates } from './fx'

const jsonRes = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response

const stub = (body: unknown, status = 200) =>
  vi.fn(async () => jsonRes(body, status)) as unknown as typeof fetch

describe('fetchDailyRates', () => {
  it('shapes provider rates into fx_rates rows', async () => {
    const fetchImpl = stub({
      amount: 1,
      base: 'USD',
      date: '2026-07-06',
      rates: { CHF: 0.79, EUR: 0.85, GBP: 0.73 },
    })
    const out = await fetchDailyRates('USD', ['EUR', 'GBP', 'CHF'], {
      fetchImpl,
    })
    expect(out.rateDate).toBe('2026-07-06')
    expect(out.rates).toContainEqual({
      fromCcy: 'USD',
      rate: 0.85,
      toCcy: 'EUR',
    })
    expect(out.rates).toHaveLength(3)
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as string
    expect(url).toContain('from=USD')
    expect(url).toContain('to=EUR,GBP,CHF')
  })

  it('maps HTTP errors', async () => {
    await expect(
      fetchDailyRates('USD', ['EUR'], { fetchImpl: stub({}, 502) })
    ).rejects.toMatchObject({ kind: 'http', provider: 'frankfurter' })
  })

  it('maps malformed payloads', async () => {
    await expect(
      fetchDailyRates('USD', ['EUR'], { fetchImpl: stub({ nope: 1 }) })
    ).rejects.toMatchObject({ kind: 'malformed' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/investments/providers/fx.test.ts`
Expected: FAIL — cannot resolve `./fx`.

- [ ] **Step 3: Implement `lib/investments/providers/fx.ts`**

```ts
import { z } from 'zod'
import { ProviderError } from './types'

/**
 * Frankfurter FX client (Inversiones A3) — free, keyless ECB daily rates
 * (exchangerate.host now requires an API key, so the build prompt's choice
 * was swapped). One call per base currency; the A5 daily job upserts the
 * result into `fx_rates`.
 */

const BASE_URL = 'https://api.frankfurter.app'

export interface DailyFxRates {
  rateDate: string // ECB business day, provider's `date`
  rates: { fromCcy: string; rate: number; toCcy: string }[]
}

const responseSchema = z.object({
  base: z.string(),
  date: z.string(),
  rates: z.record(z.string(), z.number()),
})

export async function fetchDailyRates(
  from: string,
  to: string[],
  opts: { fetchImpl?: typeof fetch } = {}
): Promise<DailyFxRates> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const res = await fetchImpl(
    `${BASE_URL}/latest?from=${encodeURIComponent(from)}&to=${to.map(encodeURIComponent).join(',')}`
  )
  if (!res.ok) {
    throw new ProviderError('frankfurter', 'http', res.status)
  }
  const parsed = responseSchema.safeParse(await res.json())
  if (!parsed.success) {
    throw new ProviderError('frankfurter', 'malformed')
  }
  return {
    rateDate: parsed.data.date,
    rates: Object.entries(parsed.data.rates).map(([toCcy, rate]) => ({
      fromCcy: parsed.data.base,
      rate,
      toCcy,
    })),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/investments/providers/fx.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/investments/providers/fx.ts lib/investments/providers/fx.test.ts
git commit -m "feat(investments): frankfurter daily FX client"
```

---

### Task 5: Provider router

**Files:**
- Create: `lib/investments/providers/index.ts`
- Test: `lib/investments/providers/index.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces (what A4/A5 import): `getQuote(target: QuoteTarget, opts?: RouterOpts): Promise<Quote>`, `searchSymbol(query: string, assetType: AssetType, opts?: RouterOpts): Promise<SymbolResult[]>` with `interface RouterOpts { apiKey?: string; fetchImpl?: typeof fetch }`; re-exports of `getFinnhubStockProfile`, `fetchDailyRates`, and all Task 1 types.

- [ ] **Step 1: Write the failing tests**

Create `lib/investments/providers/index.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { getQuote, searchSymbol } from './index'
import type { QuoteTarget } from './types'

const jsonRes = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as Response

describe('getQuote routing', () => {
  it('routes stock/etf/fund to finnhub', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes({ c: 100, t: 1 })
    ) as unknown as typeof fetch
    const target: QuoteTarget = {
      coingeckoId: null,
      currency: 'USD',
      ticker: 'AAPL',
      type: 'fund',
    }
    const q = await getQuote(target, { apiKey: 'k', fetchImpl })
    expect(q.priceCents).toBe(10000)
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as string
    expect(url).toContain('finnhub.io')
  })

  it('routes crypto to coingecko', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes({ bitcoin: { eur: 5 } })
    ) as unknown as typeof fetch
    const target: QuoteTarget = {
      coingeckoId: 'bitcoin',
      currency: 'EUR',
      ticker: 'BTC',
      type: 'crypto',
    }
    const q = await getQuote(target, { fetchImpl })
    expect(q.priceCents).toBe(500)
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as string
    expect(url).toContain('coingecko.com')
  })
})

describe('searchSymbol routing', () => {
  it('routes listed assets to finnhub', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes({ count: 0, result: [] })
    ) as unknown as typeof fetch
    await searchSymbol('apple', 'etf', { apiKey: 'k', fetchImpl })
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as string
    expect(url).toContain('finnhub.io')
  })

  it('routes crypto to coingecko', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes({ coins: [] })
    ) as unknown as typeof fetch
    await searchSymbol('btc', 'crypto', { fetchImpl })
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as string
    expect(url).toContain('coingecko.com')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/investments/providers/index.test.ts`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 3: Implement `lib/investments/providers/index.ts`**

```ts
import type { AssetType } from '@/lib/domain/investments/types'
import { getCoinGeckoQuote, searchCoinGeckoSymbols } from './coingecko'
import { getFinnhubQuote, searchFinnhubSymbols } from './finnhub'
import type { Quote, QuoteTarget, SymbolResult } from './types'

/**
 * Provider-agnostic entry point (Inversiones A3): stock | etf | fund →
 * Finnhub; crypto → CoinGecko. Fund coverage on Finnhub's free tier is thin —
 * a `not_found` ProviderError surfaces that honestly rather than guessing.
 */

export interface RouterOpts {
  apiKey?: string
  fetchImpl?: typeof fetch
}

export function getQuote(
  target: QuoteTarget,
  opts: RouterOpts = {}
): Promise<Quote> {
  return target.type === 'crypto'
    ? getCoinGeckoQuote(target, opts)
    : getFinnhubQuote(target, opts)
}

export function searchSymbol(
  query: string,
  assetType: AssetType,
  opts: RouterOpts = {}
): Promise<SymbolResult[]> {
  return assetType === 'crypto'
    ? searchCoinGeckoSymbols(query, opts)
    : searchFinnhubSymbols(query, opts)
}

export { getFinnhubStockProfile } from './finnhub'
export { type DailyFxRates, fetchDailyRates } from './fx'
export * from './types'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/investments/providers/index.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/investments/providers/index.ts lib/investments/providers/index.test.ts
git commit -m "feat(investments): provider-agnostic quote/search router"
```

---

### Task 6: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Full suite**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 2 (human, later): Live smoke**

Once A4 wires the search UI (or via a scratch script with `FINNHUB_API_KEY` set): one real Finnhub search + quote, one CoinGecko quote, one Frankfurter fetch. The sandbox cannot reach these hosts.
