# P2-03 — Generic CSV parser + column-mapping UI + templates — Design

**Status:** Approved (design) — 2026-06-23
**Covers:** P2-03 (Generic CSV/Excel parser + column-mapping UI; save mapping template)
**Parent:** `docs/superpowers/specs/2026-06-23-import-engine-design.md`
**Depends on:** P2-02 (adapter/`RawTxn` contract), P2-03 CSV core (`csv.ts`), P2-05
(`locale-parse.ts`, `encoding.ts`), P1-01 (money module).

> **Gate note.** Phase 2 is nominally gated on the Phase 1 manual browser gate.
> The user has explicitly directed building P2-03 now (user instruction
> overrides the board gate). Upload persistence (P2-01) and review/commit
> (P2-07/08) remain out of scope here — this work stops at **parse → map →
> preview → save template**, with no transaction writes.

## Goal

Let a user turn an arbitrary bank CSV into normalized `RawTxn` rows by mapping
its columns once. The mapping is saved as a reusable template keyed by the
file's header signature, so the same bank's next export auto-maps. Excel is
deferred (CSV-only MVP — the parent spec's sanctioned "lighter path"); the
adapter contract leaves room to add it later.

## Scope boundary

In scope: the pure mapping engine, the `import_templates` table + RLS, and a
column-mapping UI that previews mapped rows and saves/loads templates.

Out of scope (later tickets): retaining the uploaded file in storage (P2-01),
the new/dup/error review screen (P2-07), and committing transactions (P2-08).
The UI deliberately ends at a preview with a "review & commit coming next"
boundary and never inserts a transaction.

## Components

### 1. Mapping engine (pure) — `lib/domain/import/mapping.ts`

No I/O; fully unit-tested. Reuses `csv`, `locale-parse`, `encoding`, the money
module, and `sanitizeCell`.

```
type DateMapping = { column: string; format?: 'dmy' | 'mdy' | 'ymd' | 'auto' }

type AmountMapping =
  | { kind: 'single'; column: string; decimal?: ',' | '.'; negativeIs: 'expense' | 'income' }
  | { kind: 'debitCredit'; debitColumn: string; creditColumn: string; decimal?: ',' | '.' }

type CurrencyMapping = { column: string } | { fixed: string }

interface ColumnMapping {
  date: DateMapping
  amount: AmountMapping
  description: { column: string }
  note?: { column: string }
  currency?: CurrencyMapping
}

interface RowError { rowIndex: number; field: string; raw: string; reason: string }

function headerSignature(headers: string[]): string
function applyMapping(
  records: Record<string, string>[],
  mapping: ColumnMapping
): { rows: RawTxn[]; errors: RowError[] }
```

- **`headerSignature`** — normalize each header (trim, lowercase, strip accents,
  collapse whitespace), join with `|`, FNV-1a hash (reuse the hashing approach
  in `fingerprint.ts`). **Order-independent** is *not* assumed: header order is
  part of a bank's layout identity, so the signature preserves order. (Revisit
  only if real files prove otherwise.)
- **`amount` semantics:**
  - `single` — one signed column; `negativeIs: 'expense'` means a negative
    source value is an expense (stored as a negative `amount_cents`). An invert
    option is expressed by flipping `negativeIs`.
  - `debitCredit` — two columns; exactly one is populated per row. Debit →
    negative cents (expense), credit → positive cents (income). Both populated
    or both empty on a row → a `RowError`.
- **Per-row failures never throw.** A bad date/amount/empty-description yields a
  `RowError` (with `rowIndex`, `field`, `raw`, `reason`); valid rows still parse.
  This is what feeds the P2-07 error count later.
- Amount parsing reads the **raw** cell (pre-`sanitizeCell`) so a leading `-`/`+`
  isn't neutralized; display/preview uses the sanitized value.

### 2. Template persistence — `import_templates`

Drizzle schema `lib/db/schema/import-templates.ts` + migration `0004`, mirroring
the Phase-1 pattern (`accounts`/`categories`):

- Columns: `id uuid pk`, `user_id uuid` (owner, from JWT — never the form),
  `header_signature text`, `name text` (1..100), `mapping jsonb`,
  `created_at`/`updated_at` with the shared `set_updated_at()` trigger.
- **Unique `(user_id, header_signature)`** — one template per layout per user;
  save is an upsert on conflict.
- Four owner-scoped default-deny RLS policies (select/insert/update/delete),
  identical shape to `accounts`.
- `mapping` validated by a Zod schema (`lib/validation/import-template.ts`)
  before write — the jsonb column trusts nothing.

### 3. UI — `app/protected/import/`

RLS-enforced Supabase server client, `requireUser()` first, same conventions as
`app/protected/transactions/`.

- **`data.ts`** — `findTemplateBySignature(sig)`, `listTemplates()`.
- **`actions.ts`**:
  - `parseUpload(formData)` — receives the file via `FormData` (transient, no
    bucket): guard extension (`.csv`) + MIME + a size cap (reuse the P2-09
    intent) + a row cap; `decodeBytes` → `detectDelimiter` → `parseCsv` →
    `rowsToRecords`. Returns `{ headers, sampleRows, signature, template? }`.
    Discriminated `ActionResult` like the accounts/transactions actions.
  - `saveTemplate({ name, signature, mapping })` — validate + upsert.
- **Components** (Client where interactive): `ImportUploadForm` (file picker),
  `ColumnMappingForm` (a `<select>` per target field; an amount-mode toggle for
  single vs debit/credit), `MappingPreview` (table of mapped value vs raw +
  an error badge using `applyMapping` results), `import-page`/`page.tsx`.
- A persistent banner: "Review & commit lands in P2-07/08 — nothing is imported
  yet."

## Data flow

```
file → parseUpload (decode → delimiter → parseCsv → records)
     → headers + signature → load matching template (pre-fill mapping)
     → user adjusts ColumnMapping
     → applyMapping(records, mapping) → preview rows + errors (client-side, pure)
     → saveTemplate (upsert by signature)            [STOP — no commit]
```

## Error handling

- Upload rejects (wrong type, too big, too many rows, unparseable) → typed
  `ActionResult` error surfaced inline.
- Per-row parse failures → `RowError[]`, counted and listed in the preview;
  they never abort the batch.
- Template save validation failure → inline field errors (`useActionState`).

## Testing

- **Engine** (`mapping.test.ts`, TDD, ~15 cases): single signed column;
  debit/credit pair; locale decimals (`1.234,56` / `1,234.56`); date formats;
  missing/empty/garbage cells → `RowError`; empty description → error; signature
  stability + sensitivity to header text; `negativeIs` invert.
- **Validation** (`import-template.test.ts`): mapping schema accept/reject.
- **RLS** (`tests/rls/import-templates.rls.test.ts`, skipped without
  `TEST_DATABASE_URL`): A cannot read/write B's templates; unique-signature
  upsert behaves per-user.
- **i18n**: new `import` namespace in `messages/{en,es}.json`; the existing
  `i18n-parity.test.ts` enforces EN⇄ES key parity.

## Decisions

- Templates are managed in the Import flow (not Settings P5-01) for now.
- Single-column sign defaults to `negativeIs: 'expense'`, invertible.
- Excel deferred behind the adapter contract; CSV-only MVP.
- File handled transiently via `FormData` (no storage bucket) until P2-01.

## Open questions (deferred, not blocking)

- Whether to expose a per-template default account, or keep account selection
  per-import batch (current assumption: per-batch, set at commit time in P2-08).
- Whether header-signature should tolerate column reordering (current: no).
