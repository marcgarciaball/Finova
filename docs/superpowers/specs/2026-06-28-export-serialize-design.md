# P4-05 — Export serializer (CSV + JSON)

Status: approved (2026-06-28)
Ticket: P4-05 — Export all data to CSV + JSON (RLS-scoped)
Phase: 4 — Dashboard & export

## Goal

Let a user export their data. The pipeline is: RLS-enforced fetch of the user's
accounts/categories/transactions → serialize → download. The **serialization is
the tricky, pure, testable part** and is what this ticket ships; the
RLS-enforced fetch + the download route/UI land with the Phase 4 surface
(browser-verified). JSON output needs no custom code (`JSON.stringify` over the
fetched bundle); the value here is a correct, injection-safe **CSV serializer**.

## Decisions (locked)

1. **RFC-4180 CSV.** A field is quoted iff it contains the delimiter, a double
   quote, CR, or LF; embedded quotes double (`"` → `""`). Records are joined
   with CRLF (`\r\n`) — the RFC line ending, which Excel and our own `parseCsv`
   both accept. This is the inverse of the P2-03 `parseCsv`, so an export
   round-trips back through import.

2. **Formula-injection safe, without breaking numeric round-trip.** String cells
   pass through `sanitizeCell` (P2-09) — a leading `= + - @`/tab/CR gets a `'`
   prefix. **Number cells are never sanitized**: a JS number stringifies to
   `-?\d+(\.\d+)?`, which spreadsheets read as a number, not a formula, so it is
   not an injection vector — and sanitizing it (`-50` → `'-50`) would break the
   "export round-trips cleanly" gate. The cell's *type* (string vs number)
   decides, so the trusted/untrusted boundary is explicit per cell.

3. **`null`/`undefined` → empty field.** No `"null"` literals in the output.

4. **Header row is data.** Headers are written as a normal (quoted-as-needed)
   record; they are app-controlled strings, so they are not sanitized.

## Architecture — `lib/domain/export/serialize.ts`

```ts
export type CsvCell = string | number | null | undefined

/** Serialize rows to an RFC-4180 CSV string (CRLF-joined). String cells are
 *  formula-injection-sanitized; number cells are emitted verbatim. */
export function toCsv(headers: string[], rows: CsvCell[][]): string
```

A row whose length differs from `headers` is still serialized as-is (the caller
owns shape); the function does not pad or truncate.

## Tests — `lib/domain/export/serialize.test.ts`

- header + rows, plain values, CRLF join.
- quoting: a comma, a quote (`"` → `""`), a newline force quotes.
- a string starting with `=`/`+`/`-`/`@` is `'`-prefixed (injection guard).
- a **number** `-50` is emitted as `-50` (NOT `'-50`) — round-trip safe.
- `null`/`undefined` → empty field.
- a value with no special chars is left unquoted.
- empty rows → just the header line; round-trips back through `parseCsv`.

## Out of scope

- The RLS-enforced fetch of accounts/categories/transactions → Phase 4 action.
- The JSON bundle shape + the download route/UI → Phase 4 (browser).
- Re-import of an exported file (covered by the existing import pipeline).

## Verification

`npm run typecheck`, `npm run lint`, `npm test` green; a `parseCsv(toCsv(...))`
round-trip test proves export/import symmetry.
