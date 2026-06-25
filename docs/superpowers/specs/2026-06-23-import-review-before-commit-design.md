# P2-07 — Review-before-commit screen — Design

**Status:** Approved (design) — 2026-06-23
**Ticket:** P2-07 (Frontend) — review-before-commit screen (new/dup/error counts + row preview)
**Depends on:** P2-01 (`import_batches` + `imports` bucket), P2-03 (mapping UI + `applyMapping`), P2-06 (`fingerprint.ts` dedup core). **Unblocks:** P2-08 (idempotent commit).

## Goal

After a user has uploaded a statement and mapped its columns, P2-07 lets them
**pick the target account, see how many rows are new / duplicate / error, and
preview the parsed result before anything is written**. Nothing is committed
here — the screen ends with the batch marked `reviewed`. The commit itself is
P2-08.

This closes the loop opened by P2-03's banner ("Review & commit lands in
P2-07/08 — nothing is imported yet").

## Scope

**In:**
- An account picker as a new step in the existing single-page import flow
  ([app/protected/import/ImportClient.tsx](../../../app/protected/import/ImportClient.tsx)).
- Exact **new / duplicate / error** counts computed over **all** rows of the
  uploaded file (not the client's sample).
- A capped row preview with a per-row status badge and a "showing N of M" note.
- Persisting the chosen account, mapping, and counts onto the `import_batches`
  row and advancing `status` to `reviewed`.
- Forward-provisioning `transactions.import_fingerprint` + its partial unique
  index (used by P2-08; see below).

**Out (later tickets):**
- The Commit button and writing transactions — P2-08. No commit UI here.
- Editing individual parsed rows. The user can change the column mapping (which
  re-classifies), but not hand-edit a single cell.
- Excel parsing (still CSV-only MVP, per P2-03).

## Key decisions

### Server-side re-classification (not the client sample)

P2-03's client holds only a capped `sampleRecords` slice. Accurate counts need
every row, so review re-reads the stored file and classifies server-side:

```
reviewBatch({ batchId, accountId, mapping })            [Server Action]
  requireUser()
  → load import_batches row by id (RLS-enforced) → storage_path
  → download bytes from the 'imports' bucket
  → decodeBytes → detectDelimiter → parseCsv → rowsToRecords   (ALL rows)
  → reviewRows(records, mapping, accountId, existingFingerprints)   [pure]
  → UPDATE the batch: account_id, mapping, counts, status='reviewed'
  → return { counts, preview }     preview capped (default 100), with total
```

The file already lives in the private per-user bucket from P2-01; `batchId`
identifies it. Re-reading is cheap (files are ≤5 MB, ≤10k rows) and keeps the
counts authoritative — the client never has to ship 10k rows back.

### Account is chosen at review

Dedup is per-account and the account currency is the fallback for rows whose
mapping yields no currency, so the account must be known **before**
classification. The user picks it here. This refines the `import_batches`
schema comment ("account_id chosen at commit"): it is chosen at **review**;
commit (P2-08) reuses the persisted `account_id`. The column is already present
and nullable, so no migration is needed for this.

### Duplicate detection without a backfilled column

Every transaction today was entered by hand, so `import_fingerprint` is `null`
on all existing rows (commit, which writes it, is P2-08). Therefore:

- **Add the column + partial unique index now**, purely as P2-08
  forward-provisioning (mirrors how P2-01 provisioned `mapping`/`counts` up
  front). **No backfill** — backfilling manual rows would risk unique-index
  violations on legitimately-identical manual entries and misattribute
  provenance. With no backfill the index covers zero rows and cannot conflict.
- **P2-07 detects duplicates by computing fingerprints on the fly** over the
  selected account's existing transactions (bounded to the batch's date range).
  This catches dups against *all* prior transactions, not just future imports.

**Date convention (constraint on P2-08):** existing `occurred_at` is
`timestamptz`; its fingerprint date is the **UTC** date (`toISOString` →
`slice(0,10)`). P2-08 must store imported dates (`YYYY-MM-DD`) as UTC midnight so
a committed import re-fingerprints identically. Documented here so P2-08 honors
it.

## Components

### Pure core — `lib/domain/import/review.ts` (+ `review.test.ts`)

The testable heart, no I/O:

```ts
type RowStatus = 'new' | 'duplicate' | 'error'

interface ReviewRow {
  index: number                 // original record index (1-based, for display)
  status: RowStatus
  txn?: RawTxn                   // present when status !== 'error'
  error?: RowError               // present when status === 'error'
  fuzzy?: boolean                // advisory near-dup flag on an otherwise-'new' row
}

interface ReviewResult {
  counts: { new: number; duplicate: number; error: number }
  rows: ReviewRow[]
}

function reviewRows(
  records: Record<string, string>[],
  mapping: ColumnMapping,
  accountId: string,
  existingFingerprints: ReadonlySet<string>,
  options?: { fuzzy?: FuzzyOptions },
): ReviewResult
```

Algorithm:
1. `applyMapping(records, mapping)` → `{ rows, errors }`. Each `RowError`
   becomes a `status:'error'` `ReviewRow`; `errors.length` is the error count.
2. For each valid `RawTxn`, compute `transactionFingerprint({ accountId, ... })`.
   - in `existingFingerprints` → `duplicate` (already committed).
   - else already seen in this batch → `duplicate` (intra-batch dup).
   - else → `new`; add to the seen set.
3. Fuzzy advisory: for each `new` row, flag `fuzzy:true` if `isFuzzyDuplicate`
   matches any existing/seen row **sharing the same date+amount** (the cheap
   gate `isFuzzyDuplicate` already applies, so Levenshtein only runs within a
   date+amount bucket — naturally bounded). Fuzzy does **not** change the three
   headline counts; it is a "possible duplicate" badge for human attention.

Pure, deterministic, fully unit-tested: new, exact-dup (committed), intra-batch
dup, error passthrough, fuzzy badge, count totals, empty input.

### Data layer — `app/protected/import/data.ts`

```ts
existingFingerprintsForAccount(
  accountId: string, minDate: string, maxDate: string,
): Promise<Set<string>>
```

RLS-enforced select of `account_id, occurred_at, amount_cents, description` for
the account within `[minDate, maxDate]`, computing `transactionFingerprint` for
each (UTC date). The date bounds come from the parsed rows' min/max `occurredAt`
so the scan is tight. Returns a `Set` for O(1) membership in `reviewRows`.

### Server Action — `app/protected/import/actions.ts`

`reviewBatch({ batchId, accountId, mapping })` as sketched above. Guards:
`requireUser`; the batch must belong to the user (RLS) and be in a reviewable
state; `accountId` must be one the user owns (validated like other write paths);
mapping validated with the existing `columnMappingSchema`. Download/parse
failures map to typed errors the client localizes. Returns
`{ ok: true, counts, preview, total }` or `{ ok: false, error }`.

### UI — extend `ImportClient.tsx` (+ a small `ReviewPanel.tsx`)

After the mapping/preview card, once a mapping is valid, reveal a review card:
- account `<select>` (from `listAccounts()`),
- a "Review" button → calls `reviewBatch`,
- on success: a counts summary (new / duplicate / error) and the capped preview
  table with status badges + "showing N of M" when truncated.
Changing the account or mapping invalidates the result (re-review). The P2-03
commit banner stays until P2-08.

## i18n

Add an `import.review.*` group to `messages/en.json` and `messages/es.json`
(account label, "Review" action, count labels, the three status labels,
"possible duplicate", preview header, truncation note, review error keys). The
existing i18n-parity test enforces EN/ES symmetry.

## Schema / migration

In [lib/db/schema/transactions.ts](../../../lib/db/schema/transactions.ts):
- `importFingerprint: text('import_fingerprint')` (nullable).
- partial unique index `(user_id, import_fingerprint) where import_fingerprint
  is not null`.

Generate the next Drizzle migration (`drizzle/0006_*.sql`). **No backfill.**
`npm run db:migrate` to apply.

## Testing

- `review.test.ts` — the pure classifier (cases above). Primary coverage.
- Existing suites stay green; `npm run typecheck`, `npm run lint`, `npm test`.
- The `reviewBatch` action and `existingFingerprintsForAccount` are thin I/O
  wrappers over tested cores; manual browser verification per the gate below.
  (RLS for `import_batches`/`transactions` is already covered by their suites.)

## Manual verification

Upload a CSV, map columns, pick an account, click Review → counts appear;
re-upload the same file and review again against the same account → after a
future P2-08 commit those rows would read as duplicates (pre-commit, classify
against any existing manual transactions that match). Confirm errors (a
malformed amount row) land in the error count, not a crash.

## Out-of-scope reminders

No transaction is written in P2-07. The Commit button, the idempotent upsert on
`(user_id, import_fingerprint)`, and partial-failure handling are all P2-08.
