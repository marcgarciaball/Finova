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
