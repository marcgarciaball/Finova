# P2-08 — Idempotent commit; partial-failure handling — Design

**Phase:** 2 (Import engine). **Depends on:** P2-01 (storage + `import_batches`),
P2-03 (parser/mapping), P2-06 (fingerprint), P2-07 (review-before-commit;
forward-provisioned `transactions.import_fingerprint` + the partial unique index
in migration 0006). **Unblocks:** the Phase 2 gate and P3-03 (apply rules on
import) via the categorization seam this ticket wires.

> **Gate note.** Per the established pattern (P1-02..P2-07), code is built ahead
> of the manual browser gate and marked **Action required** for manual
> verification. **No new migration** is needed — 0006 already added
> `import_fingerprint` and the partial unique index `(user_id,
> import_fingerprint) where import_fingerprint is not null`.

## Goal

Turn a **reviewed** import batch into real ledger rows. Committing the same
statement twice — re-clicking Commit, or re-uploading the file as a fresh batch
— must leave the data unchanged. A mid-batch failure must not lose
already-committed rows, and re-running Commit must safely finish the job.

## Scope boundary

- **In:** the `commitBatch` Server Action, a pure commit-row builder, the
  chunked idempotent upsert, a categorization seam invoked during commit, the
  Commit button + result UI, batch status transition to `committed`/`failed`.
- **Out (later tickets):** the rules that the categorization seam will eventually
  apply (P3-02..P3-04 — the seam ships now, its body lands in P3-03), the
  uncategorized/needs-review list (P3-07), batch/file delete + retention sweep
  (P5-02 / the P2-01 open question), transfer detection on import, Excel parsing
  (deferred in P2-03).

## Architecture

A new `commitBatch({ batchId })` Server Action drives everything from the
**trusted persisted batch** — never from client-supplied counts or rows. The
client only names the batch; the action re-downloads, re-parses, and
re-classifies at commit time. This mirrors `reviewBatch` (P2-07) and keeps the
RLS-enforced Supabase server client as the only I/O path; owner identity comes
from the verified JWT (`claims.sub`).

### Two-layer dedup (belt and suspenders)

1. **Review-time** (`reviewRows`, P2-07) excludes rows matching *any* existing
   transaction — manual or imported — via on-the-fly fingerprinting
   (`existingFingerprintsForAccount`). Only `status === 'new'` rows are
   committed. This is what catches duplicates of **manual** rows, which carry no
   stored `import_fingerprint`.
2. **DB constraint** — the partial unique index on `(user_id,
   import_fingerprint)`. Each committed row stores its fingerprint, so
   re-committing (same batch, or a fresh re-upload) hits `ON CONFLICT DO NOTHING`
   → 0 inserted → no change. This is the idempotency backstop for the
   imported-vs-imported case and for a re-clicked Commit.

## Components

### 1. Pure core — `lib/domain/import/commit.ts` (TDD'd)

`buildCommitRows(newTxns: RawTxn[], ctx: { userId, accountId, fallbackCurrency, categoryIds }) → CommitRow[]`:

- `currency = txn.currency ?? fallbackCurrency` (caller resolves
  `fallbackCurrency` = account currency, itself falling back to profile
  `base_currency`).
- `occurred_at` = **UTC midnight**: `` `${txn.occurredAt}T00:00:00.000Z` `` — the
  P2-07 invariant, so a committed row re-fingerprints to exactly the value
  `existingFingerprintsForAccount` recomputes (which truncates `occurred_at` to
  its UTC date). Without this, a re-import would not detect the duplicate.
- `import_fingerprint = transactionFingerprint({ accountId, amountCents,
  description, occurredAt })` — identical inputs and ordering to `review.ts`'s
  `fingerprintOf`, so review and commit always agree.
- `category_id` = `categoryIds[i] ?? null` — supplied by the categorization seam
  (below). Null today.
- `is_transfer: false`, `is_recurring: false`, `note: txn.note ?? null`,
  `tags: []`, plus `user_id` and `account_id` from `ctx`.
- Export a `CHUNK_SIZE` constant (e.g. 500) used by the action's chunked upsert.

The builder is the only place that knows the transaction insert shape for
imports; it has no I/O and is fully unit-testable.

### 2. Categorization seam — `lib/domain/import/categorize.ts` (TDD'd)

`applyImportCategorization(txns: RawTxn[], rules: CategorizationRule[]) → (string | null)[]`
returns a `category_id | null` per input row, index-aligned.

P2-08 ships this seam and invokes it during commit with an **empty rule set**, so
every row resolves to `null` (uncategorized) — there is no rules engine yet.
P3-03 ("apply rules on import") implements the matching body and the action
starts passing the user's real rules. Designing the seam now keeps
auto-categorization a first-class part of the import pipeline rather than a later
bolt-on, and gives P3 a single, tested integration point. For P2-08 the seam's
contract and "empty rules ⇒ all null" behavior are the tested surface; richer
matching is explicitly P3-03's body.

### 3. Server Action — `commitBatch({ batchId })` in `app/protected/import/actions.ts`

1. `requireUser()` → `claims.sub` is the owner.
2. Load the batch (RLS scopes it). Require `status === 'reviewed'` and non-null
   `account_id` + `mapping`; otherwise `validationFailed`. A batch already in
   `committed` returns a friendly `alreadyCommitted`.
3. Resolve `fallbackCurrency`: the account's `currency`, falling back to the
   profile `base_currency`.
4. Download + parse **all** rows from the `imports` bucket (reuse the
   `reviewBatch` download/`decodeBytes`/`parseCsv`/`rowsToRecords` path — no
   sample cap).
5. Recompute `existingFingerprintsForAccount` over the parsed date range, run
   `reviewRows(records, mapping, accountId, existing)`, take `status === 'new'`
   rows' `txn`.
6. `applyImportCategorization(newTxns, [])` → `categoryIds` (all null today).
7. `buildCommitRows(newTxns, { userId, accountId, fallbackCurrency, categoryIds })`.
8. **Chunked idempotent upsert** — for each chunk of `CHUNK_SIZE`:
   `supabase.from('transactions').upsert(chunk, { onConflict:
   'user_id,import_fingerprint', ignoreDuplicates: true }).select('id')`.
   - `committed += data.length` (PostgREST returns only newly-inserted rows under
     `DO NOTHING`).
   - `skipped += chunk.length - data.length` (the conflicts — already present).
   - A chunk that returns an `error` adds its size to `failed` and **does not
     abort** the loop (other chunks still commit; the idempotent index makes a
     later retry safe).
9. Update the batch: `status = failed > 0 ? 'failed' : 'committed'`, store final
   `counts` (`committed`/`skipped`/`failed`), and `error` text when `failed > 0`.
10. `revalidatePath` for the transactions list and the import page.
11. Return `{ ok: true, committed, skipped, failed }`.

### 4. UI — `app/protected/import/ReviewPanel.tsx`

Add a **Commit** button shown once the batch is `reviewed`; disabled/hidden once
`committed`. On success, render the committed/skipped/failed tally and a link to
the transactions list. A `failed > 0` result shows a retry affordance (Commit
stays available — re-running is idempotent). New `import.commit.*` i18n keys in
`messages/{en,es}.json`; the existing i18n-parity test covers EN⇄ES.

## Data flow

```
Commit button → commitBatch({ batchId }):
  requireUser
  load batch (RLS)            // must be status 'reviewed' + account_id + mapping
  resolve fallbackCurrency    // account.currency → profile.base_currency
  storage.download → parse ALL rows
  existingFingerprintsForAccount(range) → reviewRows → take status==='new'
  applyImportCategorization(new, [])      // seam; all null today (P3-03 fills it)
  buildCommitRows(new, ctx)               // UTC-midnight date + import_fingerprint
  chunked upsert ON CONFLICT (user_id, import_fingerprint) DO NOTHING
  update batch status committed|failed + counts
  → { ok, committed, skipped, failed }
```

## Error handling

Discriminated result, never throws to the client. Errors: `batchNotFound`,
`validationFailed`, `alreadyCommitted`, `downloadFailed`, `unexpected`. A partial
DB failure returns `{ ok: true, failed > 0 }` with batch `status='failed'` and an
`error` note — recoverable, because an idempotent re-run skips the
already-committed rows and finishes the rest. Storage/table RLS is
defense-in-depth behind the app-layer ownership checks.

## Testing

- **Pure unit:** `commit.test.ts` — UTC-midnight `occurred_at`; currency
  fallback; `import_fingerprint` byte-for-byte matches `review.ts` for the same
  row; field defaults (`category_id` from `categoryIds`, transfer/recurring
  false, tags empty); `CHUNK_SIZE` boundary. `categorize.test.ts` — empty rules ⇒
  all `null`, index alignment, length preserved.
- **RLS suite:** `tests/rls/transactions.rls.test.ts` (or a focused
  `import-commit.rls.test.ts`) — a second upsert of the same fingerprints inserts
  0 rows (idempotency), and the partial unique index is per-user (user A and user
  B can each hold the same fingerprint, but a single user cannot duplicate one).
  Skipped without `TEST_DATABASE_URL`.
- No component tests (per the no-`*.test.tsx` policy).
- `npm run typecheck`, `npm run lint`, `npm test` green.
- **Action required (manual):** no migration (0006 already applied). Browser:
  upload → map → review → **Commit** → rows appear in the transactions list;
  re-upload the same file → review shows all duplicates, Commit reports
  `committed: 0` → no change.

## Decisions

- **Chunked + idempotent commit** over an all-or-nothing Postgres RPC: stays on
  the app-layer/RLS insert pattern used everywhere else, and the
  `ON CONFLICT DO NOTHING` index makes partial commits self-healing on retry, so
  true single-transaction atomicity buys little here.
- **Re-classify at commit, drive from the batch row** over trusting the client's
  reviewed counts: never trust client-supplied rows; the batch's persisted
  `mapping` + `account_id` are the trusted inputs.
- **UTC-midnight `occurred_at`**: required so committed rows re-fingerprint
  identically to what review computes (P2-07 invariant).
- **Categorization seam now, rules later**: commit runs every row through
  `applyImportCategorization` (empty rules ⇒ all `null` today); P3-03 fills the
  body. Auto-categorization is part of the pipeline by design, not deferred out
  of it.
- **`category_id` null on commit today**: the seam yields null because no rules
  exist yet — distinct from removing categorization from scope.

## Open questions (deferred, not blocking)

- Orphaned/uncommitted-batch cleanup (a sweep or TTL) — revisit with P5-02
  retention; same open question P2-01 logged.
- Whether to stamp imported rows with an `import` tag or note marker for later
  filtering — YAGNI until a consumer (P3-07 needs-review list) exists.
