# Phase 2 — Import Engine — Design (overview)

**Status:** Draft (design) — 2026-06-23
**Covers:** P2-01 … P2-09
**Depends on:** Phase 1 (accounts, categories, transactions, money). **Gated by
the Phase 1 manual gate** — implementation of Phase 2 code should not begin
until that gate passes (sign up → create account/category/transaction → totals
correct → RLS suite green against a disposable DB). This document is design only.

## Goal

Turn a user's real bank statement (CSV/Excel) into reviewed, de-duplicated
transactions, safely and idempotently, in both ES and EN locales. The user
uploads a file, maps its columns once (saved as a template), reviews a
new/duplicate/error breakdown, and commits — re-importing the same file changes
nothing.

## Architecture

```
upload (private bucket, RLS by path)
  → detect encoding + delimiter
  → parse rows (generic CSV/Excel; bank adapters override mapping/cleanup)
  → normalize (amount, date, currency) via locale-resilient parsers
  → fingerprint each row (deterministic) + fuzzy near-dup detection
  → classify: new / duplicate / error
  → review screen (counts + per-row preview, editable mapping)
  → commit (idempotent upsert keyed on fingerprint; partial-failure tolerant)
```

The pure, design-independent core — **parsing/normalization/fingerprinting** —
is plain domain code under `lib/domain/import/`, fully unit-testable with no DB.
The stateful edges (storage, commit) are thin Server Actions over the
RLS-enforced Supabase client, same rules as Phase 1.

## Tickets

- **P2-01 Storage.** Private per-user bucket; object path prefixed with the
  user id; Storage RLS policy allows a user only under their own prefix. Upload
  enforces size + MIME/extension allowlist (CSV, XLS/XLSX). No public URLs.
- **P2-02 Parser registry + `add-import-adapter` skill.** An adapter is
  `{ id, detect(sample) → boolean, parse(rows) → RawTxn[] }`. A registry picks
  the first adapter whose `detect` matches, else the generic parser. The skill
  documents how to add a bank adapter with a fixture-driven test.
- **P2-03 Generic CSV/Excel parser + column-mapping UI.** Parse to a row grid;
  user maps columns (date, amount/credit-debit, description, …) → save a
  reusable `ImportTemplate` keyed by a header signature so the same bank's files
  auto-map next time.
- **P2-04 2–3 real bank adapters.** Concrete adapters built on P2-02, each with
  an anonymized fixture and a parse test.
- **P2-05 Encoding/locale resilience.** UTF-8 + Latin-1 decoding; decimal/
  thousands variants (`1.234,56` vs `1,234.56`); date formats (`dd/mm/yyyy`,
  `mm/dd/yyyy`, ISO). **This is the first piece to build** (below) — pure,
  reusable, and needed by every adapter.
- **P2-06 De-dup.** Deterministic fingerprint = stable hash of
  `(account, occurred_at date, amount_cents, normalized description)`. A fuzzy
  fallback flags near-dups (same date+amount, description within an edit-distance
  threshold) for human review rather than auto-dropping.
- **P2-07 Review-before-commit screen.** New/duplicate/error counts + a row
  preview with the parsed vs. raw values; lets the user fix mapping and re-parse
  before committing.
- **P2-08 Idempotent commit.** Persist the fingerprint on each transaction;
  commit is an upsert on `(user_id, fingerprint)` so re-importing is a no-op.
  Partial failures roll the batch back to a resumable state, never half-commit.
- **P2-09 File-safety hardening.** Neutralize CSV formula injection (cells
  beginning `= + - @`), reject oversized/malformed files early, cap row counts,
  and never `eval` or interpolate cell content into queries.

## Schema additions (sketch, for later migrations)

- `import_batches` (id, user_id, account_id, filename, status, counts, created_at)
- `import_templates` (id, user_id, header_signature, mapping jsonb, name)
- `transactions.import_fingerprint text NULL` + partial unique
  `(user_id, import_fingerprint) where import_fingerprint is not null`
- All with the same four owner-scoped default-deny RLS policies as Phase 1.

## Open questions (resolve at implementation)

- Fuzzy-dup edit-distance threshold + whether to expose it as a setting.
- Excel parsing lib choice (e.g. SheetJS) vs. CSV-only MVP with an "export as
  CSV" hint — pick the lighter path first if Excel support slips.
- Where templates are managed in the UI (Import flow vs. Settings P5-01).
