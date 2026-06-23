# Phase 2 — P2-04 Bank Adapters — Design

**Status:** Draft (design) — 2026-06-23
**Covers:** P2-04 (2–3 real bank adapters; this design ships four)
**Depends on:** P2-02 (adapter contract + registry), P2-03 (CSV parser + column-mapping engine), P2-05 (locale parsers), P1-01 (money module). Pure domain code — no DB, no storage. Buildable ahead of the Phase 1 gate, like the other Phase 2 cores.

## Goal

Give Finova out-of-the-box recognition for four real bank statement exports so a
user importing from a known bank gets correct, signed, ISO-normalized
transactions with **zero manual column mapping**. Each adapter recognizes one
bank's CSV layout and normalizes its rows into `RawTxn[]`, reusing the existing
parsing/locale/money cores. When no adapter matches, the registry returns `null`
and the caller falls back to the generic column-mapping flow (P2-03).

## Architecture

Adapters are thin layers over the engine that already exists — they differ only
in *which columns mean what*, which `ColumnMapping` + `applyMapping`
(`lib/domain/import/mapping.ts`) already express.

```
ParsedCsv ({headers, rows})
  → registry.select(parsed)            # first adapter whose detect() matches, else null
  → adapter.parse(parsed)              # rowsToRecords → applyMapping(records, mapping)
  → { rows: RawTxn[], errors: RowError[] }
```

- **`defineMappingAdapter({ id, signatureHeaders, mapping })`** — builds an
  `ImportAdapter` from a fixed `ColumnMapping`. `detect` returns true when the
  file's normalized headers contain every header in `signatureHeaders`
  (order-tolerant, matching the skill's guidance and reusing `mapping.ts`'s
  header normalization — trim, lowercase, strip accents, collapse whitespace).
  `parse` runs `rowsToRecords(parsed)` then `applyMapping(records, mapping)`.
  ING, Revolut, and CaixaBank are declared this way.
- **BBVA** is hand-written because its export carries a title/preamble line above
  the header row, so by the time `parseCsv` runs (header = row 0), the real
  header is buried in `rows`. Its `detect` scans `parsed.headers` **and**
  `parsed.rows` for the BBVA header signature line; its `parse` locates that line,
  re-keys the following rows against it, and delegates to the **same**
  `applyMapping` + `ColumnMapping`. The preamble-skipping quirk is isolated to
  this one adapter — exactly where the skill says adapter complexity belongs.

Nothing re-implements delimiter detection, locale decimals/dates, or cents math:
those come from `csv.ts`, `locale-parse.ts`, and the money module via
`applyMapping`.

## Contract change to `adapter.ts`

`ImportAdapter.parse` changes from `(parsed) => RawTxn[]` to
`(parsed) => { rows: RawTxn[]; errors: RowError[] }` (reusing `RowError` from
`mapping.ts`). Rationale: `applyMapping` already returns per-row errors, and the
P2-07 review screen reports new/duplicate/**error** counts — an adapter that
silently dropped malformed rows would make those counts wrong. The registry and
`selectAdapter` are unchanged (they only call `detect`). Only the inline test
adapters in `adapter.test.ts` need updating to return the new shape. This is
cheap now: P2-02 is pre-gate and not yet wired into any caller.

`RowError` stays defined in `mapping.ts` (its existing home) and `adapter.ts`
imports it with `import type`. `mapping.ts` already imports `RawTxn` from
`adapter.ts`, so this is a *type-only* import cycle — erased at compile time,
no runtime cycle, and handled cleanly by TypeScript.

## File layout

```
lib/domain/import/
  adapters/
    define-mapping-adapter.ts     # the helper + its unit test
    ing.ts  bbva.ts  revolut.ts  caixabank.ts
    index.ts                      # createBankRegistry() — registration = priority
    <bank>.test.ts                # one parse test per adapter (fixture-driven)
    registry.test.ts              # select() routing across all fixtures
  fixtures/
    ing.csv  bbva.csv  revolut.csv  caixabank.csv
```

`createBankRegistry()` registers ES banks first (ING, BBVA, CaixaBank) then
Revolut, via `createAdapterRegistry([...])`. Order only matters if two `detect`s
both match; the signatures are distinct enough that they should not.

## Per-bank layouts (from documented formats; fixtures anonymized)

All amounts → signed integer cents (expense negative) via the money module; all
dates → ISO `YYYY-MM-DD`. Fixtures carry a representative mix: an income row, an
expense row, a quoted field, and (where it applies) per-row currency.

- **ING España** — delimiter `;`. Headers `F. VALOR ; CATEGORÍA ; SUBCATEGORÍA ;
  DESCRIPCIÓN ; COMENTARIO ; IMAGEN ; IMPORTE (€) ; SALDO (€)`. ES decimals
  `1.234,56`, dates `dd/mm/yyyy`. `AmountMapping kind:'single'`, column
  `IMPORTE (€)`, `negativeIs:'expense'`, `decimal:','`. `DESCRIPCIÓN` →
  description. `SALDO (€)` (running balance) is ignored. No per-row currency
  (the column is the symbol €, not an ISO code) → currency falls back to the
  account at import time.
- **BBVA** — delimiter `;`, one preamble line above the header (same delimiter as
  the data). Headers `Fecha ; Concepto ; Importe ; Divisa ; Disponible`. ES
  decimals, dates `dd/mm/yyyy`. `kind:'single'`, column `Importe`,
  `negativeIs:'expense'`, `decimal:','`. `Concepto` → description. `Divisa` →
  per-row currency (ISO, e.g. `EUR`). `Disponible` ignored.
- **Revolut** — delimiter `,`. Headers `Type , Product , Started Date ,
  Completed Date , Description , Amount , Fee , Currency , State , Balance`. EN
  decimals `1234.56`, `Completed Date` is an ISO datetime
  (`YYYY-MM-DD HH:MM:SS`); `parseDateToIso` with `ymd` takes the date part.
  `kind:'single'`, column `Amount`, `negativeIs:'expense'`, `decimal:'.'`.
  `Description` → description. `Currency` → per-row currency. `Fee`/`Balance`/
  `State` ignored.
- **CaixaBank** — delimiter `;`. Headers `Fecha ; Concepto ; Cargo ; Abono ;
  Saldo`. ES decimals, dates `dd/mm/yyyy`. `AmountMapping kind:'debitCredit'`,
  `debitColumn:'Cargo'`, `creditColumn:'Abono'`, `decimal:','` (debit → expense
  negative, credit → income positive; one populated per row). `Concepto` →
  description. `Saldo` ignored.

## Testing (TDD, fixture-driven)

Per the `add-import-adapter` skill, write the test first, watch it fail, then
implement. For each adapter:

1. `detect` is true for its own fixture's `ParsedCsv` and false for at least one
   other bank's fixture.
2. `parse` yields the exact `RawTxn[]` expected from the fixture (signed cents,
   ISO dates, descriptions, currency where the layout provides it) and the
   expected `errors` (empty for the clean fixtures; one adapter's fixture
   includes a deliberately malformed amount row to prove it becomes a `RowError`
   rather than crashing the batch or being silently dropped).

A `registry.test.ts` asserts `createBankRegistry().select(parsed)` routes each
fixture to the right adapter id and returns `null` for an unrecognized header set
(generic-fallback contract). `define-mapping-adapter.test.ts` covers the helper's
detect (superset match, order-tolerance, accent/case-insensitivity) independent
of any one bank.

Run: `npx vitest run lib/domain/import`.

## Scope and known limitations

- **Pure domain only.** No upload/storage/commit wiring — that lands with P2-01
  (storage) and P2-07/08 (review + commit). This ticket proves the registry
  recognizes real layouts and normalizes them correctly.
- **Fixtures are built from documented layouts, not verified against live
  exports.** A real file from any of these banks may differ (extra columns,
  renamed headers, a different preamble); `detect`'s superset match tolerates
  extra columns, and a mismatch simply falls through to the generic mapping flow
  rather than mis-parsing. Real-file verification is a follow-up once P2-01 makes
  the upload path testable.
- **Preamble + delimiter detection.** `detectDelimiter` scans the first non-empty
  line; if a bank's preamble used a *different* delimiter than its data,
  detection could pick the wrong one and corrupt the parse. The BBVA fixture
  keeps the preamble on the data delimiter (realistic — one file, one delimiter).
  Robust multi-delimiter preamble handling is out of scope, noted for the P2-07
  wiring.
- **Currency.** Adapters set `RawTxn.currency` only from an explicit ISO code
  column (BBVA `Divisa`, Revolut `Currency`). A bare `€` symbol is not an ISO
  code, so ING/CaixaBank leave currency unset and the import flow falls back to
  the account currency — matching the existing `mapping.ts` contract.

## Definition of Done

- Four adapters under `lib/domain/import/adapters/`, each with an anonymized
  fixture (no real PII/IBANs) and a parse test written test-first.
- `parse` returns `{ rows, errors }`; amounts are signed integer cents via the
  money module (no floats/`parseFloat`); dates ISO via `parseDateToIso`.
- Each `detect` true for its bank, false for at least one other.
- `createBankRegistry()` routes fixtures correctly and falls back to `null`.
- `adapter.ts` contract updated; `adapter.test.ts` green.
- `npm run typecheck`, `npm run lint`, `npm test` all green.
- PROGRESS.md P2-04 row → status updated with a notes block.
