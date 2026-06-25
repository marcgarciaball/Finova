# P2-07 Review-before-commit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a review step to the import flow that classifies every uploaded row as new / duplicate / error against the chosen account, shows counts + a capped preview, and marks the batch `reviewed` — writing no transactions.

**Architecture:** A pure classifier (`review.ts`) layers `applyMapping` (P2-03) + `transactionFingerprint` (P2-06) into new/dup/error verdicts. A Server Action re-reads the stored file from the `imports` bucket by `batchId`, parses all rows, fetches the account's existing fingerprints (computed on the fly), runs the classifier, and persists `account_id`/`mapping`/`counts`/`status='reviewed'` on `import_batches`. The UI extends the existing single-page `ImportClient`. A forward-provisioning migration adds `transactions.import_fingerprint` for P2-08.

**Tech Stack:** Next.js App Router (Server Actions), Drizzle + Supabase (RLS), Zod, next-intl, Vitest, Biome.

## Global Constraints

- Money is **signed integer cents** (ADR-007); never float math. Amounts come from the money module via `applyMapping`.
- Every read/write goes through the **RLS-enforced** Supabase server client; the owner is derived from the verified JWT (`requireUser().sub`), never the form.
- **No transaction is written in P2-07.** The flow stops at `status='reviewed'`.
- Fingerprint date is the **UTC** date portion (`occurredAt.slice(0,10)`); existing `timestamptz` rows use `toISOString().slice(0,10)`.
- i18n: every user-facing string has an `en` + `es` key; the i18n-parity test must stay green.
- Verification gate per task: `npm run typecheck`, `npm run lint`, `npm test` all green.
- Package manager is **npm**; formatter/linter is **Biome** (`npm run lint`).
- Agent cannot commit (sandbox blocks git writes); a human runs the commit steps. Leave the working tree commit-ready.

---

### Task 1: Pure classifier — `lib/domain/import/review.ts`

**Files:**
- Create: `lib/domain/import/review.ts`
- Test: `lib/domain/import/review.test.ts`

**Interfaces:**
- Consumes: `applyMapping(records, mapping) → { rows: RawTxn[]; errors: RowError[] }` and `RowError` from `./mapping`; `ColumnMapping` from `./mapping`; `RawTxn` from `./adapter`; `transactionFingerprint`, `isFuzzyDuplicate`, `type FuzzyOptions` from `./fingerprint`.
- Produces: `reviewRows(records, mapping, accountId, existingFingerprints, options?) → ReviewResult`; types `RowStatus`, `ReviewRow`, `ReviewResult`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { reviewRows } from './review'
import type { ColumnMapping } from './mapping'

const mapping: ColumnMapping = {
  date: { column: 'Date', format: 'ymd' },
  amount: { kind: 'single', column: 'Amount', negativeIs: 'expense', decimal: 'dot' },
  description: { column: 'Desc' },
}

const rec = (date: string, amount: string, desc: string) => ({
  Date: date,
  Amount: amount,
  Desc: desc,
})

describe('reviewRows', () => {
  it('classifies a fresh row as new', () => {
    const res = reviewRows([rec('2026-01-01', '-12.99', 'Coffee')], mapping, 'acc-1', new Set())
    expect(res.counts).toEqual({ new: 1, duplicate: 0, error: 0 })
    expect(res.rows[0]).toMatchObject({ index: 1, status: 'new' })
    expect(res.rows[0].txn?.amountCents).toBe(-1299)
  })

  it('marks a row whose fingerprint already exists as a duplicate', () => {
    const one = reviewRows([rec('2026-01-01', '-12.99', 'Coffee')], mapping, 'acc-1', new Set())
    const fp = one.rows[0].txn ? undefined : undefined // fingerprint asserted via the existing-set path below
    const existing = new Set<string>()
    // derive the fingerprint by re-running with the row pre-registered:
    const res = reviewRows(
      [rec('2026-01-01', '-12.99', 'Coffee')],
      mapping,
      'acc-1',
      new Set([
        // transactionFingerprint of acc-1 | 2026-01-01 | -1299 | coffee
        // computed in the implementation; assert via counts, not the literal hash
      ]),
    )
    void fp
    void existing
    void res
  })

  it('marks a second identical row in the same batch as a duplicate (intra-batch)', () => {
    const res = reviewRows(
      [rec('2026-01-01', '-12.99', 'Coffee'), rec('2026-01-01', '-12.99', 'Coffee')],
      mapping,
      'acc-1',
      new Set(),
    )
    expect(res.counts).toEqual({ new: 1, duplicate: 1, error: 0 })
    expect(res.rows.map((r) => r.status)).toEqual(['new', 'duplicate'])
  })

  it('routes an unparseable row to the error count instead of throwing', () => {
    const res = reviewRows([rec('2026-01-01', 'not-a-number', 'Coffee')], mapping, 'acc-1', new Set())
    expect(res.counts).toEqual({ new: 0, duplicate: 0, error: 1 })
    expect(res.rows[0].status).toBe('error')
    expect(res.rows[0].error).toBeDefined()
  })

  it('flags a near-duplicate of an existing row as fuzzy without changing the counts', () => {
    // same date+amount, description differs by a few chars → fuzzy advisory
    const res = reviewRows([rec('2026-01-01', '-12.99', 'Coffee Shp')], mapping, 'acc-1', new Set(), {
      seenTxns: [{ accountId: 'acc-1', amountCents: -1299, description: 'Coffee Shop', occurredAt: '2026-01-01' }],
    })
    expect(res.counts.new).toBe(1)
    expect(res.rows[0].fuzzy).toBe(true)
  })

  it('returns zeroed counts for empty input', () => {
    const res = reviewRows([], mapping, 'acc-1', new Set())
    expect(res.counts).toEqual({ new: 0, duplicate: 0, error: 0 })
    expect(res.rows).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/import/review.test.ts`
Expected: FAIL — `reviewRows` is not defined / cannot resolve `./review`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { RawTxn } from './adapter'
import {
  type FuzzyOptions,
  isFuzzyDuplicate,
  transactionFingerprint,
} from './fingerprint'
import { applyMapping, type ColumnMapping, type RowError } from './mapping'

/** The headline verdict for a single parsed row. */
export type RowStatus = 'new' | 'duplicate' | 'error'

export interface ReviewRow {
  /** 1-based original record index, for display. */
  index: number
  status: RowStatus
  /** Present when status !== 'error'. */
  txn?: RawTxn
  /** Present when status === 'error'. */
  error?: RowError
  /** Advisory near-dup flag on an otherwise-'new' row; does not affect counts. */
  fuzzy?: boolean
}

export interface ReviewResult {
  counts: { new: number; duplicate: number; error: number }
  rows: ReviewRow[]
}

export interface ReviewOptions {
  fuzzy?: FuzzyOptions
  /** Existing transactions (same account) used for the fuzzy near-dup pass. */
  seenTxns?: RawTxn[]
}

/** A RawTxn-shaped key for transactionFingerprint (accountId + the row fields). */
function fingerprintOf(accountId: string, txn: RawTxn): string {
  return transactionFingerprint({
    accountId,
    amountCents: txn.amountCents,
    description: txn.description,
    occurredAt: txn.occurredAt,
  })
}

/**
 * Classify every record as new / duplicate / error against the chosen account.
 * Exact duplicates (deterministic fingerprint) drive the headline counts;
 * fuzzy near-dups are an advisory badge on otherwise-'new' rows. Pure: no I/O.
 */
export function reviewRows(
  records: Record<string, string>[],
  mapping: ColumnMapping,
  accountId: string,
  existingFingerprints: ReadonlySet<string>,
  options: ReviewOptions = {},
): ReviewResult {
  const { rows, errors } = applyMapping(records, mapping)

  const out: ReviewRow[] = []
  for (const error of errors) {
    out.push({ index: error.row, status: 'error', error })
  }

  const seen = new Set<string>()
  // Bucket existing + batch-seen txns by date|amount so fuzzy Levenshtein only
  // runs within a matching bucket (isFuzzyDuplicate already gates on this).
  const fuzzyPool: RawTxn[] = [...(options.seenTxns ?? [])]

  rows.forEach((txn, i) => {
    const fp = fingerprintOf(accountId, txn)
    let status: RowStatus
    if (existingFingerprints.has(fp) || seen.has(fp)) {
      status = 'duplicate'
    } else {
      status = 'new'
      seen.add(fp)
    }

    const row: ReviewRow = { index: i + 1, status, txn }
    if (status === 'new') {
      const fuzzy = fuzzyPool.some((other) =>
        isFuzzyDuplicate(
          { accountId, amountCents: txn.amountCents, description: txn.description, occurredAt: txn.occurredAt },
          { accountId, amountCents: other.amountCents, description: other.description, occurredAt: other.occurredAt },
          options.fuzzy,
        ),
      )
      if (fuzzy) {
        row.fuzzy = true
      }
    }
    fuzzyPool.push(txn)
    out.push(row)
  })

  const counts = {
    new: out.filter((r) => r.status === 'new').length,
    duplicate: out.filter((r) => r.status === 'duplicate').length,
    error: errors.length,
  }
  return { counts, rows: out }
}
```

> NOTE: confirm `RowError`'s index field name (`row`) and `isFuzzyDuplicate`'s parameter shape against `mapping.ts`/`fingerprint.ts` before finalizing; adjust the property reads if they differ. Delete the placeholder no-op assertions in the second test once you can assert against a known fingerprint (compute it with `transactionFingerprint` inside the test and pass it in the `existingFingerprints` set).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/domain/import/review.test.ts`
Expected: PASS (rewrite the duplicate-against-existing test to compute the fingerprint via `transactionFingerprint` and seed the set, asserting `counts.duplicate === 1`).

- [ ] **Step 5: Typecheck + lint, then commit**

```bash
npm run typecheck && npm run lint
git add lib/domain/import/review.ts lib/domain/import/review.test.ts
git commit -m "feat(p2-07): pure new/dup/error classifier for import review"
```

---

### Task 2: Forward-provision `transactions.import_fingerprint`

**Files:**
- Modify: `lib/db/schema/transactions.ts`
- Create: `drizzle/0006_*.sql` (generated)

**Interfaces:**
- Produces: a nullable `import_fingerprint` text column + partial unique index `(user_id, import_fingerprint) where import_fingerprint is not null`. No code consumes it in P2-07; P2-08 will.

- [ ] **Step 1: Add the column + index to the schema**

In `lib/db/schema/transactions.ts`, add to the column block (after `transferGroupId`/`isRecurring`):

```ts
    // Forward-provisioned for P2-08 idempotent commit; null until an import
    // writes it. P2-07 does NOT backfill (manual rows stay null), so the
    // partial unique index below covers zero rows and cannot conflict.
    importFingerprint: text('import_fingerprint'),
```

Add to the table-extras array (after the transfer-group index, before the policies):

```ts
    uniqueIndex('transactions_user_import_fingerprint_uniq')
      .on(table.userId, table.importFingerprint)
      .where(sql`${table.importFingerprint} is not null`),
```

Add `uniqueIndex` to the `drizzle-orm/pg-core` import.

- [ ] **Step 2: Generate the migration**

Run: `npm run db:generate` (or the project's drizzle-kit generate script — check `package.json`)
Expected: a new `drizzle/0006_*.sql` adding the column and the partial unique index. Inspect it: it must `ADD COLUMN "import_fingerprint" text` and `CREATE UNIQUE INDEX ... WHERE "import_fingerprint" is not null`, with **no UPDATE/backfill**.

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/db/schema/transactions.ts drizzle/
git commit -m "feat(p2-07): forward-provision transactions.import_fingerprint + partial unique index"
```

> Apply with `npm run db:migrate` against the dev DB before browser verification (Task 6).

---

### Task 3: Data layer — `existingFingerprintsForAccount`

**Files:**
- Modify: `app/protected/import/data.ts`

**Interfaces:**
- Consumes: `transactionFingerprint` from `@/lib/domain/import/fingerprint`; the RLS-enforced server client.
- Produces: `existingFingerprintsForAccount(accountId: string, minDate: string, maxDate: string): Promise<Set<string>>`.

- [ ] **Step 1: Add the read helper**

Append to `app/protected/import/data.ts`:

```ts
import { transactionFingerprint } from '@/lib/domain/import/fingerprint'

/**
 * Deterministic fingerprints of the account's existing transactions within
 * [minDate, maxDate] (inclusive, ISO dates). Computed on the fly because manual
 * transactions carry no stored fingerprint (P2-08 writes it). Used by the
 * review classifier to flag rows that already exist. RLS-scoped to the caller.
 */
export async function existingFingerprintsForAccount(
  accountId: string,
  minDate: string,
  maxDate: string,
): Promise<Set<string>> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('transactions')
    .select('account_id, occurred_at, amount_cents, description')
    .eq('account_id', accountId)
    .gte('occurred_at', `${minDate}T00:00:00Z`)
    .lte('occurred_at', `${maxDate}T23:59:59Z`)

  if (error) {
    throw new Error(error.message)
  }

  const out = new Set<string>()
  for (const row of data ?? []) {
    out.add(
      transactionFingerprint({
        accountId: row.account_id as string,
        amountCents: Number(row.amount_cents),
        description: row.description as string,
        occurredAt: new Date(row.occurred_at as string).toISOString().slice(0, 10),
      }),
    )
  }
  return out
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/protected/import/data.ts
git commit -m "feat(p2-07): existingFingerprintsForAccount read helper"
```

> No unit test: thin RLS-scoped I/O over the already-tested `transactionFingerprint`. Verified end-to-end in Task 6.

---

### Task 4: Server Action — `reviewBatch`

**Files:**
- Modify: `app/protected/import/actions.ts`

**Interfaces:**
- Consumes: `reviewRows` (Task 1), `existingFingerprintsForAccount` (Task 3), `decodeBytes`/`detectDelimiter`/`parseCsv`/`rowsToRecords` (existing cores — match how `parse-upload.ts` composes them), `columnMappingSchema` from `@/lib/validation/import-template`, the RLS server client, `requireUser`.
- Produces: `reviewBatch(input: { batchId: string; accountId: string; mapping: unknown }): Promise<ReviewActionResult>`; exported type `ReviewActionResult`.

- [ ] **Step 1: Add the action + result type**

Add to `app/protected/import/actions.ts`:

```ts
import { existingFingerprintsForAccount } from './data'
import { reviewRows, type ReviewRow } from '@/lib/domain/import/review'
import { columnMappingSchema } from '@/lib/validation/import-template'
// plus the same core imports parse-upload.ts uses: decodeBytes, detectDelimiter,
// parseCsv, rowsToRecords — import from their existing modules.

const PREVIEW_CAP = 100
const NOT_FOUND = 'batchNotFound'
const DOWNLOAD_FAILED = 'downloadFailed'

export type ReviewActionResult =
  | {
      ok: true
      counts: { new: number; duplicate: number; error: number }
      preview: ReviewRow[]
      total: number
    }
  | { ok: false; error: string }

export async function reviewBatch(input: {
  batchId: string
  accountId: string
  mapping: unknown
}): Promise<ReviewActionResult> {
  const claims = await requireUser()

  const parsedMapping = columnMappingSchema.safeParse(input.mapping)
  if (!parsedMapping.success) {
    return { ok: false, error: VALIDATION_FAILED }
  }

  const supabase = await createClient()

  // 1. Load the batch (RLS scopes it to the caller).
  const { data: batch, error: batchErr } = await supabase
    .from('import_batches')
    .select('id, storage_path')
    .eq('id', input.batchId)
    .maybeSingle()
  if (batchErr || !batch) {
    return { ok: false, error: NOT_FOUND }
  }

  // 2. Verify the chosen account belongs to the caller.
  const { data: account } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', input.accountId)
    .maybeSingle()
  if (!account) {
    return { ok: false, error: VALIDATION_FAILED }
  }

  // 3. Download + parse ALL rows (no sample cap on the count path).
  let records: Record<string, string>[]
  try {
    const dl = await supabase.storage.from(BUCKET).download(batch.storage_path as string)
    if (dl.error || !dl.data) {
      return { ok: false, error: DOWNLOAD_FAILED }
    }
    const bytes = new Uint8Array(await dl.data.arrayBuffer())
    const text = decodeBytes(bytes)
    const delimiter = detectDelimiter(text)
    const parsed = parseCsv(text, delimiter)
    records = rowsToRecords(parsed.headers, parsed.rows)
  } catch {
    return { ok: false, error: UNEXPECTED }
  }

  // 4. Existing fingerprints, bounded to the batch's date range, then classify.
  const fp = (r: Record<string, string>) => r // placeholder; dates derived below
  void fp
  const dates = records
    .map((_, i) => i) // replaced below by mapped occurredAt extraction
  void dates

  const provisional = reviewRows(records, parsedMapping.data, input.accountId, new Set())
  const occurred = provisional.rows
    .filter((r) => r.txn)
    .map((r) => r.txn?.occurredAt as string)
    .sort()
  const minDate = occurred[0] ?? '0001-01-01'
  const maxDate = occurred[occurred.length - 1] ?? '9999-12-31'
  const existing = await existingFingerprintsForAccount(input.accountId, minDate, maxDate)
  const result = reviewRows(records, parsedMapping.data, input.accountId, existing)

  // 5. Persist review state on the batch.
  const { error: updErr } = await supabase
    .from('import_batches')
    .update({
      account_id: input.accountId,
      mapping: parsedMapping.data,
      counts: result.counts,
      status: 'reviewed',
    })
    .eq('id', input.batchId)
  if (updErr) {
    return { ok: false, error: UNEXPECTED }
  }

  return {
    ok: true,
    counts: result.counts,
    preview: result.rows.slice(0, PREVIEW_CAP),
    total: result.rows.length,
  }
}
```

> NOTE: the `fp`/`dates` placeholder lines are scaffolding to delete — the real flow is the two-pass: classify once with an empty set to extract the mapped `occurredAt` range, fetch existing fingerprints for that range, then classify again with the real set. Keep the two-pass; remove the dead `void` lines. Confirm `decodeBytes`/`detectDelimiter`/`parseCsv`/`rowsToRecords` signatures against `parse-upload.ts` (it composes exactly these) and mirror them.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS (remove all `void`/placeholder scaffolding first).

- [ ] **Step 3: Commit**

```bash
git add app/protected/import/actions.ts
git commit -m "feat(p2-07): reviewBatch server action — classify all rows, persist reviewed state"
```

---

### Task 5: i18n keys for the review step

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`

**Interfaces:**
- Produces: an `import.review.*` group consumed by Task 6's UI.

- [ ] **Step 1: Add the EN keys**

Under `import` in `messages/en.json`, add:

```json
"review": {
  "heading": "Review before import",
  "account": "Import into account",
  "accountPlaceholder": "Choose an account…",
  "run": "Review",
  "running": "Reviewing…",
  "newCount": "{count, plural, one {# new} other {# new}}",
  "duplicateCount": "{count, plural, one {# duplicate} other {# duplicates}}",
  "errorCount": "{count, plural, one {# error} other {# errors}}",
  "status": { "new": "New", "duplicate": "Duplicate", "error": "Error" },
  "fuzzy": "Possible duplicate",
  "truncated": "Showing {shown} of {total} rows",
  "errors": {
    "batchNotFound": "We couldn't find that upload. Please re-upload the file.",
    "downloadFailed": "We couldn't read the uploaded file. Please try again.",
    "validationFailed": "Check the account and column mapping, then try again.",
    "unexpected": "Something went wrong while reviewing. Please try again."
  }
}
```

- [ ] **Step 2: Add the matching ES keys**

Under `import` in `messages/es.json`, add the same structure with Spanish copy (e.g. `"heading": "Revisar antes de importar"`, `"account": "Importar en la cuenta"`, `"run": "Revisar"`, `"status": { "new": "Nueva", "duplicate": "Duplicada", "error": "Error" }`, `"fuzzy": "Posible duplicado"`, `"truncated": "Mostrando {shown} de {total} filas"`, etc.).

- [ ] **Step 3: Run the i18n-parity test**

Run: `npx vitest run -t "i18n"` (or the project's parity test path — locate it with `grep -rl "parity\|en.*es" tests messages __tests__`)
Expected: PASS — EN and ES key sets match.

- [ ] **Step 4: Lint + commit**

```bash
npm run lint
git add messages/en.json messages/es.json
git commit -m "feat(p2-07): i18n keys for the review step"
```

---

### Task 6: Review UI in `ImportClient` (+ `ReviewPanel`)

**Files:**
- Create: `app/protected/import/ReviewPanel.tsx`
- Modify: `app/protected/import/ImportClient.tsx`
- Modify: `app/protected/import/page.tsx` (pass the account list down)

**Interfaces:**
- Consumes: `reviewBatch`, `ReviewActionResult` (Task 4); `listAccounts` from `@/app/protected/accounts/data`; `AccountRow` from `@/lib/validation/account`; `useTranslations('import')`.
- Produces: a `<ReviewPanel>` rendered after the mapping card when a mapping is valid.

- [ ] **Step 1: Load accounts in the page (server) and pass to the client**

In `app/protected/import/page.tsx`, fetch `listAccounts()` server-side and pass `accounts={accounts}` into `<ImportClient>`. Add an `accounts: AccountRow[]` prop to `ImportClient`.

- [ ] **Step 2: Build `ReviewPanel.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Label } from '@/components/ui/Label'
import type { AccountRow } from '@/lib/validation/account'
import type { ColumnMapping } from '@/lib/domain/import/mapping'
import { reviewBatch, type ReviewActionResult } from './actions'

export function ReviewPanel({
  batchId,
  mapping,
  accounts,
}: {
  batchId: string
  mapping: ColumnMapping
  accounts: AccountRow[]
}) {
  const t = useTranslations('import')
  const [accountId, setAccountId] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ReviewActionResult | null>(null)

  async function onReview() {
    if (!accountId) return
    setRunning(true)
    setResult(await reviewBatch({ batchId, accountId, mapping }))
    setRunning(false)
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <h2 className="font-medium text-ink">{t('review.heading')}</h2>
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="review-account">{t('review.account')}</Label>
            <select
              id="review-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="rounded-xl border border-glass-line bg-glass px-3 py-2 text-ink text-sm"
            >
              <option value="">{t('review.accountPlaceholder')}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" onClick={onReview} disabled={running || accountId === ''}>
            {running ? t('review.running') : t('review.run')}
          </Button>
        </div>

        {result && !result.ok ? (
          <p className="text-neg text-sm">{t(`review.errors.${result.error}` as never)}</p>
        ) : null}

        {result?.ok ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-4 text-sm">
              <span className="text-pos">{t('review.newCount', { count: result.counts.new })}</span>
              <span className="text-ink-soft">{t('review.duplicateCount', { count: result.counts.duplicate })}</span>
              <span className="text-neg">{t('review.errorCount', { count: result.counts.error })}</span>
            </div>
            {result.total > result.preview.length ? (
              <p className="text-ink-soft text-xs">
                {t('review.truncated', { shown: result.preview.length, total: result.total })}
              </p>
            ) : null}
            <ul className="flex flex-col gap-1 text-sm">
              {result.preview.map((row) => (
                <li key={row.index} className="flex items-center gap-2">
                  <span className="text-ink-soft text-xs tabular-nums">{row.index}</span>
                  <span>{t(`review.status.${row.status}`)}</span>
                  {row.fuzzy ? <span className="text-warn text-xs">{t('review.fuzzy')}</span> : null}
                  {row.txn ? (
                    <span className="text-ink-soft">
                      {row.txn.occurredAt} · {row.txn.amountCents} · {row.txn.description}
                    </span>
                  ) : (
                    <span className="text-neg">{row.error?.message}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
```

> NOTE: match the exact `Button`/`Card`/`Label` import paths and the Tailwind token classes (`text-pos`, `text-neg`, `text-warn`, `text-ink-soft`, `border-glass-line`, `bg-glass`) already used in `ImportClient.tsx`/`ColumnMappingForm.tsx`. Confirm `RowError`'s message field name. If the project has a reusable `Select` component, use it instead of a raw `<select>`.

- [ ] **Step 3: Render `ReviewPanel` from `ImportClient`**

In `ImportClient.tsx`, after the mapping `<Card>` (inside the `loaded ? (...)` block), render:

```tsx
<ReviewPanel batchId={loaded.batchId} mapping={mapping} accounts={accounts} />
```

Add `accounts` to the component props and import `ReviewPanel`. Gate it so it only shows once `mapping` is structurally valid (reuse whatever validity signal `MappingPreview` relies on — e.g. a non-empty required-field check), so a half-filled mapping doesn't enable Review.

- [ ] **Step 4: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Manual browser verification**

Apply the migration first: `npm run db:migrate`. Then `npm run dev`:
1. Upload a CSV, map its columns, pick an account, click **Review** → new/duplicate/error counts render; preview shows rows with status badges.
2. Include a deliberately malformed amount row → it lands in the **error** count, no crash.
3. Manually create a transaction matching one CSV row (same account/date/amount/description), re-review → that row reads as **duplicate**.
4. Two identical rows in the file → one **new**, one **duplicate**.
5. Switch the language to ES → all review strings localized.

- [ ] **Step 6: Commit**

```bash
git add app/protected/import/ReviewPanel.tsx app/protected/import/ImportClient.tsx app/protected/import/page.tsx
git commit -m "feat(p2-07): review-before-commit UI — account picker, counts, row preview"
```

---

### Task 7: Wire-up sweep + PROGRESS update

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Full verification**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green; new `review.test.ts` cases pass; i18n parity passes; no existing test regresses.

- [ ] **Step 2: Update PROGRESS.md**

Flip the P2-07 row to `REVIEW` with a one-line note mirroring the other P2 entries (pure classifier + reviewBatch action + account-picker UI + forward-provisioned `import_fingerprint`; commit deferred to P2-08; verify in browser). Note the migration to apply.

- [ ] **Step 3: Commit**

```bash
git add PROGRESS.md
git commit -m "docs(p2-07): mark review-before-commit in review"
```

---

## Self-Review

**Spec coverage:**
- Server-side re-classification → Task 4. ✓
- Account chosen at review (currency fallback, dedup scope) → Tasks 4, 6. ✓
- Exact new/dup/error counts over all rows → Tasks 1, 4. ✓
- Capped preview + "showing N of M" → Tasks 4 (`PREVIEW_CAP`/`total`), 6 (`truncated`). ✓
- Persist account_id/mapping/counts/status='reviewed' → Task 4. ✓
- Fingerprint column + partial unique index, no backfill → Task 2. ✓
- On-the-fly existing fingerprints, date-bounded, UTC date → Task 3. ✓
- Fuzzy advisory badge (no count change) → Task 1, surfaced in Task 6. ✓
- i18n EN/ES parity → Task 5. ✓
- Pure classifier unit-tested; I/O wrappers verified manually → Tasks 1, 6. ✓
- No transaction written → enforced by scope; no insert into `transactions` anywhere. ✓

**Placeholder scan:** The two intentional scaffolding notes (Task 1 second test, Task 4 `void` lines) are flagged with explicit "delete this" instructions, not left as silent TODOs. No "add error handling"-style hand-waving.

**Type consistency:** `reviewRows` signature, `ReviewRow`/`ReviewResult`/`ReviewActionResult`, `existingFingerprintsForAccount` match across Tasks 1/3/4/6. `counts` shape `{ new, duplicate, error }` is identical in Tasks 1, 4, 6. `PREVIEW_CAP`/`total`/`preview` consistent between Tasks 4 and 6.

**Open verification points for the implementer** (confirm against source, adjust reads — not blockers): `RowError`'s index/message field names (`mapping.ts`); `isFuzzyDuplicate` parameter shape (`fingerprint.ts`); the exact db:generate/db:migrate script names (`package.json`); the i18n-parity test path; the UI token classes and whether a shared `Select` component exists.
