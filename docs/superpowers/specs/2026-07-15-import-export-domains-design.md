# Import / Export across domains — design

**Date:** 2026-07-15 · **Branch:** feat/component-foundation

## Problem

The `/protected/data` ("Datos") screen already has outer **Import / Export** tabs, but
both are transactions-only. Users want to import/export **any domain** — Everything,
Transactions (expenses & income), Investments (stocks), Real Estate — from that one
screen, choosing direction and domain.

## Locked decisions

- **Full import + export, all domains** (phased — see decomposition).
- **Round-trip** for Investments & Real Estate import: import consumes Finova's own
  export format (fixed schema, no mapping wizard) → acts as backup/restore +
  move-between-accounts. Transactions keeps its existing external-bank CSV/Excel
  importer.
- **Idempotent, skip-duplicates** on import: content fingerprint per row, scoped per
  user (same model as today's transaction import). Re-import into the same account is a
  no-op; import into a fresh/other account creates everything.
- **JSON is the round-trip channel.** Per-domain CSV is a human/spreadsheet
  convenience (transactions CSV round-trips through the bank importer; the others are
  export-only).

## Domains and their round-trip data

| Domain (UI label)       | User-owned rows carried                                   | Excluded (recomputed/re-fetched on import) |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------ |
| Transactions            | accounts, categories, transactions                        | —                                          |
| Investments (Stocks)    | portfolios, investment_accounts, investment_transactions, + minimal `assets` reference | holdings, portfolio_snapshots, cached_quotes, historical_prices, dividend_events, fx_rates |
| Real Estate             | properties, loans, valuations, rental income, expenses    | —                                          |

The investments bundle carries a **minimal `assets` reference** (id, type, ticker, isin,
coingecko_id, exchange, name, currency) so the future import can re-resolve holdings by
symbol; derived/shared cached data is never in the file.

## Decomposition (4 sequential specs)

- **Spec A — Domain-aware Export + JSON backup bundle** (this iteration).
- **Spec B — Round-trip import engine + Real Estate import** (parse/validate versioned
  JSON → fingerprint dedupe → new-UUID + FK remap → review summary → idempotent commit).
- **Spec C — Investments round-trip import** (asset resolution + trigger background sync).
- **Spec D — "Everything" restore across all domains in FK order + nav discoverability.**

---

## Spec A — Domain-aware Export + JSON backup bundle

### Envelope (the contract Spec B validates against)

One versioned envelope for every JSON download — per-domain and "Everything" differ only
in which domain keys are present:

```jsonc
{
  "meta": {
    "app": "finova",
    "schemaVersion": 1,
    "exportedAt": "<iso, injected by caller>",
    "domains": ["transactions", "investments", "realEstate"],
    "counts": { "transactions": { "transactions": 42, "accounts": 3, "categories": 17 }, ... },
    "filters": { ... }            // only when transactions were filtered
  },
  "transactions": { "accounts": [...], "categories": [...], "transactions": [...] },
  "investments":  { "portfolios": [...], "accounts": [...], "assets": [...], "transactions": [...] },
  "realEstate":   { "properties": [...], "loans": [...], "valuations": [...], "income": [...], "expenses": [...] }
}
```

`BACKUP_SCHEMA_VERSION = 1` is exported from the bundle core.

### Pieces

- **Bundle core** (pure, extend `lib/domain/export/bundle.ts`): `AssetRef` type,
  `InvestmentsExportInput`/`RealEstateExportInput` types, `buildBackupBundle(parts, meta)`
  that assembles the envelope from whichever domains are supplied and computes `counts`;
  flat CSV serializers `investmentTransactionsCsv(txns, assets)` and
  `propertiesCsv(properties)` built on `toCsv` (formula-safe, major-unit numbers).
- **Read layer** (extend `app/protected/export/data.ts`, RLS server client):
  `getInvestmentsExportData()` (transactions → referenced asset ids → assets;
  portfolios; investment_accounts) and `getRealEstateExportData()` (the five tables).
  Every row parsed through its existing zod schema.
- **Routes** (`app/protected/export/`, each `requireUser()` + `attachment` + `no-store`):
  - `backup.json` — domain-parameterized via `?domains=transactions,investments,realEstate`
    (default all); honors the transaction filter params. This one route serves Everything
    **and** each per-domain JSON.
  - `investments.csv`, `real-estate.csv` — flat CSV. (`transactions.csv` already exists.)
  - Legacy `data.json` (flat transactions bundle) left untouched; the new UI links
    `backup.json` instead.
- **UI** (`ExportPanel` / `ExportFilters`): URL-driven domain selector
  (`?domain=everything|transactions|investments|realEstate`). Filter bar shows only for
  Transactions + Everything. Download cards adapt: Everything → one Full-backup JSON card;
  each domain → CSV + JSON cards pointing at the routes above.
- **i18n**: extend the `export` namespace (domain labels + card copy), EN/ES parity.

### Tests

Pure bundle/serializer unit tests: envelope shape + `schemaVersion` + per-domain `counts`;
CSV injection-safety and major-unit round-trip; partial-domain envelope omits absent keys.
RLS read tests follow the existing skip-without-`TEST_DATABASE_URL` pattern.

### Deliberate scope calls

- Child real-estate tables (loans/valuations/income/expenses) ride in JSON only; CSV covers
  the flat parent rows.
- No import behavior in Spec A. The envelope is the forward contract; Spec B consumes it.

---

## Spec B — Round-trip import engine + Real Estate import

Consumes the Spec A envelope. Real Estate first because it is fully user-owned (no
asset resolution, no service-role writes). Transactions-from-JSON and the "Everything"
restore are Spec D; Investments is Spec C.

### Idempotency: DB fingerprint columns

Add a nullable `import_fingerprint text` column + a partial unique index
`(user_id, import_fingerprint) WHERE import_fingerprint IS NOT NULL` to each round-trip
table (migration 0017: `properties`, `property_loans`, `property_valuations`,
`rental_income`, `property_expenses`). Mirrors the transactions import: `ON CONFLICT
(user_id, import_fingerprint) DO NOTHING` is the concurrency backstop; app-layer
fingerprinting still classifies new/duplicate at review time (so a manually-created row
that matches an incoming one is also recognised, since its stored fingerprint is NULL).
Manual CRUD never sets the column, so existing flows are untouched.

### Content fingerprints (id-independent)

`fnv1a` over a canonical key (reusing `lib/domain/import/fingerprint.ts`). The child key
embeds the **parent** fingerprint, not its id, so it survives the id remap:

- property: `name | type | purchase_date | purchase_price_cents | currency`
- loan: `propertyFp | lender_name | start_date | original_amount_cents`
- valuation: `propertyFp | valuation_date | value_cents`
- income: `propertyFp | period_start | period_end | amount_cents`
- expense: `propertyFp | expense_date | category | amount_cents | description`

### Engine (`lib/domain/import/backup/`, pure)

- `parseBackup(json)` → validates envelope (`meta.app === 'finova'`,
  `meta.schemaVersion === BACKUP_SCHEMA_VERSION`, else a typed error), then zod-parses each
  present domain through the existing row schemas. Rows carry export ids only as transient
  keys; they are never trusted as DB ids.
- `planRealEstateImport(parsed, existing)` → pure. `existing` is the set of the user's
  current fingerprints (parents + children). Computes each incoming row's fingerprint,
  classifies `new | duplicate`, resolves every child to its parent by the parent's
  fingerprint, and returns `{ counts: perTable {new,duplicate}, inserts: ordered plan }`.
  A child whose parent is a duplicate still inserts if the child itself is new (partial
  merge); a child orphaned by a bad file is dropped to an `error` count, never guessed.

### Read + commit (`app/protected/import/real-estate/`)

- `data.ts#getRealEstateFingerprints()` — RLS read of the five tables projected to the
  columns each fingerprint needs; returns the existing-fingerprint set + a parentFp→id map.
- `actions.ts#commitRealEstateBackup(parsed)` — `requireUser()`, RLS server client (all
  rows user-owned, no service role). Insert properties first (new `gen_random_uuid`,
  `user_id` from JWT, `import_fingerprint` set, `onConflict(user_id,import_fingerprint)
  ignore`), read back the resolved ids, then insert children with remapped `property_id`.
  Returns `{ committed, skipped, errors }` per table. `current_value_cents` is taken from
  the imported property as-is (valuations are data, not recomputed).

### UI (Import tab)

Add the same domain selector as Export (`?domain=`). Transactions keeps its external-bank
wizard. Real Estate renders a round-trip flow: drop/upload a Finova JSON → `parseBackup`
→ a review card showing per-table new/duplicate/error counts → Commit. Investments and
Everything show a "coming soon" note (Specs C/D).

### Tests

Pure: `parseBackup` (version/app/shape rejection), `planRealEstateImport`
(new/duplicate/partial-merge/parent-remap/orphan-drop), fingerprint stability. RLS commit
idempotency test in the skip-without-`TEST_DATABASE_URL` pattern.

### Pending human step

`npm run db:migrate` for 0017 before the Real Estate import can run.

---

## Spec C — Investments round-trip import

Extends the engine to the Investments domain. Same round-trip contract and
idempotent-skip model; the wrinkle is a **shared `assets` table** the
transactions reference.

### Idempotency (migration 0018)

`import_fingerprint` + partial unique index on `portfolios`,
`investment_accounts`, `investment_transactions` (user-owned). `assets` is shared
and deduped by its own symbol constraints; `holdings`/`portfolio_snapshots`/
quotes/history are derived and never imported.

### Fingerprints (`investments-fingerprint.ts`)

- portfolio: `name | base_currency`
- account: `portfolioFp | name | currency`
- transaction: `portfolioFp | assetKey | type | traded_at | quantity |
  price_cents | currency`, numerics normalized with `Number` (Postgres returns
  numeric/bigint as strings; incoming rows are numbers).
- `assetKey` = `cg:<coingecko_id>` → `tk:<ticker>:<exchange>` → `is:<isin>` →
  `nm:<name>`. The id-independent asset identity, since the same security has
  different DB ids across environments.

### Asset resolution (no provider calls)

The exported asset ref carries currency/exchange/isin/coingecko_id, so commit
resolves each asset with a single admin upsert — `onConflict('coingecko_id')`
for crypto, `onConflict('ticker,exchange')` otherwise — matching or creating the
shared row and returning its id. No Finnhub/CoinGecko round-trips at import time.

### Engine + commit

- `planInvestmentsImport(parsed, existing)` (pure): classifies portfolios,
  accounts (parented by portfolio), transactions; resolves each txn's portfolio +
  account by fingerprint and asset by symbol; unknown account → no-account, missing
  portfolio/asset → error. Returns per-table counts + `assetsByExportId` for commit.
- `commitInvestmentsBackup` (`'use server'`): insert portfolios → accounts (remapped
  portfolio id) → resolve assets → transactions (remapped portfolio/account/asset,
  `import_fingerprint`), all RLS with `user_id` from JWT (assets via admin client).
  Then `after(refreshPrices)` rebuilds holdings + snapshots + history from the
  transaction log (transactions are truth).

### UI

The Real Estate `RealEstateImport` component is generalized to a reusable
`BackupImport` (namespace + table list + review/commit actions), now used for both
Real Estate and Investments. Investments replaces its "coming soon" note; only
Everything remains a placeholder (Spec D).

### Pending human step

`npm run db:migrate` for 0018 before the Investments import can run.

---

## Spec D — "Everything" restore + discoverability

Completes the decomposition: the Transactions domain gains a round-trip path, and
a single "Everything" flow restores a whole backup across all domains.

### Transactions round-trip (migration 0019)

`import_fingerprint` + partial unique index on `accounts` and `categories`
(`transactions` already had one from the CSV importer). Fingerprints:

- account: `name | type | currency`
- category: `kind | name | parentFp` (two-level; `parentFp` empty for top-level)
- transaction: **reuses the CSV importer's `transactionFingerprint`** (resolved
  account DB id + amount + description + date). Because it's computed on the
  resolved account id, a JSON restore dedupes against CSV-imported *and* manual
  rows through the same `(user_id, import_fingerprint)` index — one dedup across
  both channels. The planner only fingerprints transactions under an
  already-existing account (real id known); those under a brand-new account are
  necessarily new, and the commit stamps the final fingerprint once the account
  id exists.

Commit order: accounts → categories (parents before children) → transactions.
Transfer group ids are remapped to fresh UUIDs so a transfer's two legs stay
linked. The existing external-bank CSV wizard is unchanged; transactions
round-trip JSON is reached only via "Everything".

### "Everything" orchestrator

`everything/actions.ts` fans out to the three domain importers over the same file
and aggregates per-domain totals. A domain **absent** from the file (`no<Domain>`)
maps to zeros, not an error; a genuine parse failure (malformed / notFinova /
unsupportedVersion) from any domain aborts the whole restore; an empty file →
`empty`. Domains are independent, so commit order is irrelevant and idempotency
makes a partial retry safe.

### UI + discoverability

The Everything view uses the shared `BackupImport` with a per-domain review table
(Transactions / Investments / Real estate). The Data section is now a top-nav link
(`data.nav`), not just an avatar-menu destination.

### Pending human step

`npm run db:migrate` for 0019 before Transactions/Everything restore can run.

### Status

Decomposition complete: A (export) · B (engine + real estate) · C (investments) ·
D (transactions + everything + nav). Browser/QA verification of every import path,
and the four migrations (0016–0019) applied, remain the gate to ✅.
