# P2-01 — Import storage: private per-user bucket + upload — Design

**Phase:** 2 (Import engine). **Depends on:** Phase 1 (accounts) and the
already-built pure import core (P2-02 registry, P2-03 parser/mapping,
P2-05 locale/encoding, P2-06 fingerprint). **Unblocks:** P2-05 file-read
wiring, P2-07 review-before-commit, P2-08 idempotent commit.

> **Gate note.** Phase 2 is nominally gated on the Phase 1 manual browser gate.
> Per the established pattern (P1-02..P2-06), code + migration are built ahead of
> the gate and marked **Action required** for manual `db:migrate` + browser
> verification; `npm run build` cannot run in this sandbox.

## Goal

Give the import flow a real, owner-isolated place to put an uploaded statement so
the multi-step pipeline (upload → map → review → commit) can survive across
requests. P2-01 delivers: a private per-user Supabase Storage bucket with
path-prefix RLS, an `import_batches` table that records each upload and its
lifecycle state, and a Server Action that validates, stores, records, and parses
an upload in one round trip.

The raw file **persists** in the bucket and is re-read at commit time (P2-08);
the batch row is the source of truth for per-upload state. Files are **retained
until the user deletes them** (explicit delete UI lands in P5-02 GDPR).

## Scope boundary

- **In:** bucket + storage RLS, `import_batches` schema + RLS, pure path/upload
  validation helpers, the reworked upload Server Action, carrying the `batchId`
  in the import UI.
- **Out (later tickets):** the review screen (P2-07), idempotent commit and
  retention/cleanup (P2-08), explicit batch/file delete UI (P5-02), Excel
  *parsing* (deferred in P2-03 — Excel files upload and store but return a
  friendly `excelNotSupported` at parse).

## Architecture

P2-01 is the stateful layer beneath the existing pure core. All file and table
I/O goes through the **RLS-enforced Supabase server client** (anon key + user
JWT) — never the service role — so storage and table RLS are both enforced,
consistent with the rest of the app. Owner identity always comes from the
verified JWT (`claims.sub`), never the form.

The Drizzle migration that creates `import_batches` is **hand-extended** with the
bucket creation and `storage.objects` RLS policies (same convention used to
hand-add triggers in migrations 0001–0004; Drizzle does not model
`storage.objects`).

## Components

### 1. Schema — `lib/db/schema/import-batches.ts`

The per-upload record, created with its **full lifecycle column set now** so
P2-07/08 need no further migration (a deliberate forward-provision; P2-01 only
ever writes `status: 'uploaded'`):

- `id` uuid PK (default `gen_random_uuid()`)
- `user_id` uuid not null (owner; RLS subject)
- `account_id` uuid nullable — FK `accounts` **ON DELETE set null** (chosen at
  commit, not at upload)
- `storage_path` text not null **unique** (the object key in the bucket)
- `filename` text (original name, sanitized for display)
- `mime_type` text, `byte_size` bigint
- `status` text + check `in ('uploaded','mapped','reviewed','committed','failed')`
  — **P2-01 writes only `'uploaded'`**; the rest reserved for P2-07/08
- `mapping` jsonb nullable — the chosen `ColumnMapping` (set in P2-07)
- `counts` jsonb nullable — new/dup/error tallies (set in P2-07)
- `error` text nullable
- `created_at` / `updated_at` timestamptz; `import_batches_set_updated_at`
  trigger reusing `set_updated_at()`
- four owner-scoped default-deny RLS policies (select/insert/update/delete)
  mirroring `accounts`
- indexes: `user_id`, `(user_id, created_at desc)`

### 2. Bucket + storage RLS (hand-added SQL in the migration)

- Private bucket `imports`: `public = false`, `file_size_limit = 5242880`
  (5 MB), `allowed_mime_types` = `text/csv`, `application/vnd.ms-excel`,
  `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- Four `storage.objects` RLS policies (select/insert/update/delete), each scoped
  to `bucket_id = 'imports' AND (storage.foldername(name))[1] = auth.uid()::text`
  — a user can touch objects only under their own `${userId}/` prefix.

### 3. Pure helpers (tested)

- `lib/domain/import/storage-path.ts`
  - `buildStoragePath(userId, batchId, filename)` →
    `${userId}/${batchId}/${safeName(filename)}`
  - `safeName(filename)` — strips path separators and control characters, caps
    length, preserves the extension
  - `isOwnedPath(path, userId)` — guard that a path sits under the user's prefix
- `lib/domain/import/upload-file.ts`
  - `validateUpload({ name, size, type })` — extension allowlist
    (`.csv/.xls/.xlsx`), size cap, empty-file check; returns a typed result,
    never throws. Distinct from `parse-upload.ts`'s CSV-*parse* guards.

### 4. Server Action — `app/protected/import/actions.ts` (reworked `parseUpload`)

`uploadImport(prev, formData)`:

1. `requireUser()` → `claims.sub` is the owner.
2. Read the `File`; `validateUpload` on name/size/type → reject early
   (`noFile` / `tooLarge` / `unsupportedType`).
3. `batchId = crypto.randomUUID()`; `path = buildStoragePath(...)`.
4. `supabase.storage.from('imports').upload(path, bytes, { contentType, upsert: false })`
   — `contentType` derived from the extension so odd browser MIME values don't
   false-reject. On failure → `storageFailed`.
5. Insert the `import_batches` row (`status: 'uploaded'`, path, filename, mime,
   size). If the insert fails after a successful upload, best-effort delete the
   orphaned object, then return `unexpected`.
6. `parseUploadBytes(bytes)` on the same bytes (no re-download). On parse
   failure (e.g. Excel) return the parse error (`excelNotSupported`, etc.) —
   the file and batch still exist.
7. Template lookup by signature (unchanged).
8. Return `{ ok: true, batchId, data, template }`.

`saveTemplate` is unchanged. No delete action in P2-01 (retention = retain until
the user deletes; delete UI is P5-02).

### 5. UI — `app/protected/import/ImportClient.tsx`

Minimal: capture `batchId` from the upload result and hold it in state so P2-07's
commit can reference the batch. The mapping/preview UI is otherwise unchanged.

## Data flow

```
upload form → uploadImport(formData):
  requireUser → validateUpload → randomUUID
  → storage.upload(path, bytes)
  → insert import_batches(status:'uploaded', storage_path, ...)
  → parseUploadBytes(bytes)         // same bytes, no second download
  → template lookup by signature
  → { ok, batchId, data, template }
ImportClient holds batchId → existing mapping UI
```

## Error handling

Discriminated `ParseResult`, never throws to the client. Typed errors:
`noFile`, `tooLarge`, `unsupportedType`, `excelNotSupported`, `storageFailed`,
`unexpected`. Storage RLS is defense-in-depth behind the app-layer checks.
Orphaned-object cleanup is best-effort on a post-upload insert failure.

## Testing

- **Pure unit tests:** `storage-path.test.ts` (safeName edge cases, owned-path
  guard), `upload-file.test.ts` (allowlist, size, empty, ext/MIME mismatch).
- **RLS suite:** `tests/rls/import-batches.rls.test.ts` — user A cannot
  read/insert/update/delete user B's batches; storage-object isolation under a
  foreign prefix if feasible. Skipped without `TEST_DATABASE_URL`, mirroring the
  existing RLS suites.
- No component tests (per the no-`*.test.tsx` policy).
- `npm run typecheck`, `npm run lint`, `npm test` green.
- **Action required (manual):** `npm run db:migrate` to apply the migration +
  bucket/policies; run the RLS suite against a disposable DB; verify upload in
  the browser. `npm run build` cannot run in this sandbox.

## Decisions

- **Approach A (Server Action upload)** over client direct-to-Storage: one round
  trip, all validation server-side, reuses the existing actions pattern, no
  redundant re-download to parse.
- **Raw file persists, re-read at commit** over carrying the parsed batch
  client-side: matches the design overview's pipeline and gives P2-08 an
  authoritative source.
- **CSV + Excel allowlist now** even though Excel parsing is deferred: uploads
  store; parse returns `excelNotSupported`.
- **Retain until user deletes**: no auto-delete on commit; delete UI is P5-02.
- **Full lifecycle columns now**: avoids a per-ticket migration for P2-07/08.

## Open questions (deferred, not blocking)

- Orphaned-batch cleanup (uploaded, never committed) — a sweep or a TTL; revisit
  with P2-08 retention.
- Whether `account_id` should be required at upload vs. chosen during review
  (currently nullable, chosen at/after mapping).
