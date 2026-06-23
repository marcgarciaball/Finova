# Skill: add-import-adapter

**Trigger:** any time you teach Finova to read a new bank's statement export (P2-04 and beyond). Reach for an adapter only when a real file doesn't map cleanly through the generic column-mapping flow (P2-03) — e.g. credit/debit split across two columns, a metadata preamble, locale-specific amounts/dates.

**Goal:** a pure, fixture-driven adapter that recognizes one bank's format and normalizes its rows into `RawTxn[]`, plus a parse test against an anonymized fixture.

## The contract

An adapter implements `ImportAdapter` from [`lib/domain/import/adapter.ts`](../../lib/domain/import/adapter.ts):

```ts
interface ImportAdapter {
  readonly id: string
  detect(parsed: ParsedCsv): boolean   // recognize the file from its headers/markers
  parse(parsed: ParsedCsv): RawTxn[]   // normalize recognized rows
}
```

`RawTxn` is account-agnostic (the account is chosen per import batch, not by the adapter): `{ occurredAt, amountCents, description, currency?, note? }`.

## Steps

1. **Get an anonymized fixture.** Save a real export with names/IBANs/amounts scrubbed under `lib/domain/import/fixtures/<bank>.csv`. Keep the exact header row, delimiter, decimal format, and a representative row mix (income, expense, a quoted field).
2. **Write the parse test first** (TDD — [`add-money-safe-feature`](add-money-safe-feature.md) rules apply to anything touching money). Assert `detect` is true for this fixture's parsed headers (and false for a foreign one), then assert `parse` yields the exact `RawTxn[]` you expect — signed cents, ISO dates, descriptions.
3. **Reuse the pure core — never re-implement parsing.**
   - Delimiter + RFC-4180 parsing: `parseCsv` / `detectDelimiter` ([`csv.ts`](../../lib/domain/import/csv.ts)).
   - Locale amounts (`1.234,56`, parens-for-negative, currency symbols): `parseDecimalToCanonical` → money module for the signed cents.
   - Dates (`dd/mm/yyyy` etc.): `parseDateToIso` ([`locale-parse.ts`](../../lib/domain/import/locale-parse.ts)).
4. **`detect` on a stable signature.** Match on the bank's header set (or a marker line) — specific enough not to false-positive on another bank, tolerant of column reordering. It receives the already-parsed `ParsedCsv`, so detect against `parsed.headers`.
5. **`parse` is total and pure.** Map credit/debit columns to a single signed `amountCents` (expense negative). No I/O, no `Date.now()`, no throwing on a normal row — surface a bad cell as an error row upstream (P2-07), don't crash the batch.
6. **Register it** in the adapter registry (priority = registration order; earlier = higher). Registration is rejected on a duplicate `id`.

## Checklist (maps to Definition of Done)

- [ ] Anonymized fixture committed; no real PII or account numbers.
- [ ] Parse test written first and watched fail, then green.
- [ ] `detect` true for this bank, false for at least one other fixture.
- [ ] Amounts are signed integer cents via the money module — no floats, no `parseFloat`.
- [ ] Dates normalized to ISO `YYYY-MM-DD` via `parseDateToIso`.
- [ ] Adapter reuses `csv`/`locale-parse`; no bespoke delimiter/decimal/date code.
- [ ] `parse` never throws on a well-formed row; registered with a unique `id`.

## Run the tests

```bash
npx vitest run lib/domain/import
```
