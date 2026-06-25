# P2-08 — Idempotent Commit; Partial-Failure Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a reviewed import batch into real ledger rows via an idempotent, partial-failure-tolerant commit.

**Architecture:** A `commitBatch({ batchId })` Server Action drives everything from the trusted persisted batch — it re-downloads, re-parses, and re-classifies, then writes via a chunked idempotent upsert (`ON CONFLICT (user_id, import_fingerprint) DO NOTHING`). A pure commit-row builder and a categorization seam (empty rules today; P3-03 fills the body) are TDD'd in isolation. The UI gains a Commit button after a successful review.

**Tech Stack:** Next.js App Router Server Actions, RLS-enforced Supabase server client (anon key + user JWT, never service role), Drizzle schema, TypeScript strict, next-intl (EN/ES), Vitest, Biome.

## Global Constraints

- Owner identity ALWAYS from the verified JWT (`claims.sub`), NEVER from client input.
- All I/O through the RLS-enforced Supabase server client (`createClient()`), NEVER the service role.
- NEVER trust client-supplied rows/counts: commit re-downloads, re-parses, and re-classifies from the persisted batch; the client supplies only `batchId`.
- Money is signed integer cents. `occurred_at` is stored as **UTC midnight** (`` `${occurredAt}T00:00:00.000Z` ``) so committed rows re-fingerprint identically to what `existingFingerprintsForAccount` recomputes.
- `import_fingerprint` inputs and ordering must match `review.ts`'s `fingerprintOf` exactly: `transactionFingerprint({ accountId, amountCents, description, occurredAt })`.
- **No new migration** — `drizzle/0006_*.sql` already added `import_fingerprint` and the partial unique index `(user_id, import_fingerprint) where import_fingerprint is not null`.
- Pure domain core (no I/O) is TDD'd; no `*.test.tsx` component tests.
- Bilingual i18n parity (EN + ES) — both files updated together; the existing parity test covers EN⇄ES.
- Discriminated result types; Server Actions never throw to the client.
- Run `npm run typecheck`, `npm run lint`, `npm test` green before declaring done.

---

### Task 1: Categorization seam — `lib/domain/import/categorize.ts`

**Files:**
- Create: `lib/domain/import/categorize.ts`
- Test: `lib/domain/import/categorize.test.ts`

**Interfaces:**
- Consumes: `RawTxn` from `./adapter`.
- Produces:
  - `interface CategorizationRule { /* P3-03 fills fields */ }`
  - `applyImportCategorization(txns: RawTxn[], rules: CategorizationRule[]): (string | null)[]` — returns a `category_id | null` per input row, index-aligned, same length as `txns`. Empty rules ⇒ all `null`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import type { RawTxn } from './adapter'
import { applyImportCategorization } from './categorize'

const txn = (description: string): RawTxn => ({
  amountCents: -1000,
  description,
  occurredAt: '2026-01-15',
})

describe('applyImportCategorization', () => {
  it('returns null for every row when no rules are given', () => {
    const txns = [txn('Coffee'), txn('Rent'), txn('Salary')]
    expect(applyImportCategorization(txns, [])).toEqual([null, null, null])
  })

  it('preserves length and index alignment for an empty input', () => {
    expect(applyImportCategorization([], [])).toEqual([])
  })

  it('returns one entry per input row', () => {
    const txns = [txn('a'), txn('b')]
    expect(applyImportCategorization(txns, [])).toHaveLength(txns.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- categorize`
Expected: FAIL — `applyImportCategorization` is not defined / module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { RawTxn } from './adapter'

/**
 * Auto-categorization seam for imports (wired in P2-08, body in P3-03).
 *
 * P2-08 invokes this during commit with an empty rule set, so every row
 * resolves to `null` (uncategorized) — there is no rules engine yet. Wiring the
 * seam now keeps auto-categorization a first-class step of the import pipeline
 * rather than a later bolt-on, and gives P3-03 a single, tested integration
 * point. Pure: no I/O.
 */

/** A categorization rule. Fields are defined by P3-03 ("apply rules on import"). */
export interface CategorizationRule {
  /** Placeholder until P3-03 defines the matcher shape. */
  readonly _placeholder?: never
}

/**
 * Resolve a `category_id | null` for each transaction, index-aligned with
 * `txns`. With no rules every row is `null`; P3-03 implements the matching body.
 */
export function applyImportCategorization(
  txns: RawTxn[],
  rules: CategorizationRule[]
): (string | null)[] {
  // No rules engine yet (P3-03): every row is uncategorized.
  if (rules.length === 0) {
    return txns.map(() => null)
  }
  return txns.map(() => null)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- categorize`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add lib/domain/import/categorize.ts lib/domain/import/categorize.test.ts
git commit -m "feat(import): add auto-categorization seam (P2-08)"
```

---

### Task 2: Commit-row builder — `lib/domain/import/commit.ts`

**Files:**
- Create: `lib/domain/import/commit.ts`
- Test: `lib/domain/import/commit.test.ts`

**Interfaces:**
- Consumes: `RawTxn` from `./adapter`; `transactionFingerprint` from `./fingerprint`.
- Produces:
  - `const CHUNK_SIZE = 500`
  - `interface CommitContext { userId: string; accountId: string; fallbackCurrency: string; categoryIds: (string | null)[] }`
  - `interface CommitRow { user_id: string; account_id: string; category_id: string | null; amount_cents: number; currency: string; occurred_at: string; description: string; note: string | null; tags: string[]; is_recurring: boolean; is_transfer: boolean; import_fingerprint: string }`
  - `buildCommitRows(newTxns: RawTxn[], ctx: CommitContext): CommitRow[]`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import type { RawTxn } from './adapter'
import { buildCommitRows, CHUNK_SIZE } from './commit'
import { transactionFingerprint } from './fingerprint'

const ACCOUNT = 'acct-1'
const USER = 'user-1'

const txn = (over: Partial<RawTxn> = {}): RawTxn => ({
  amountCents: -1234,
  description: 'Coffee',
  occurredAt: '2026-01-15',
  ...over,
})

const ctx = (over: Partial<Parameters<typeof buildCommitRows>[1]> = {}) => ({
  userId: USER,
  accountId: ACCOUNT,
  fallbackCurrency: 'EUR',
  categoryIds: [],
  ...over,
})

describe('buildCommitRows', () => {
  it('stores occurred_at as UTC midnight', () => {
    const [row] = buildCommitRows([txn({ occurredAt: '2026-03-09' })], ctx())
    expect(row?.occurred_at).toBe('2026-03-09T00:00:00.000Z')
  })

  it('uses the row currency when present, else the fallback', () => {
    const rows = buildCommitRows(
      [txn({ currency: 'USD' }), txn({})],
      ctx({ fallbackCurrency: 'EUR' })
    )
    expect(rows[0]?.currency).toBe('USD')
    expect(rows[1]?.currency).toBe('EUR')
  })

  it('computes an import_fingerprint that matches review.ts inputs', () => {
    const t = txn({ amountCents: -555, description: 'Tienda', occurredAt: '2026-02-02' })
    const [row] = buildCommitRows([t], ctx())
    expect(row?.import_fingerprint).toBe(
      transactionFingerprint({
        accountId: ACCOUNT,
        amountCents: -555,
        description: 'Tienda',
        occurredAt: '2026-02-02',
      })
    )
  })

  it('takes category_id from categoryIds by index, defaulting to null', () => {
    const rows = buildCommitRows(
      [txn(), txn(), txn()],
      ctx({ categoryIds: ['cat-a', null] })
    )
    expect(rows[0]?.category_id).toBe('cat-a')
    expect(rows[1]?.category_id).toBeNull()
    expect(rows[2]?.category_id).toBeNull()
  })

  it('sets stable defaults and carries user/account/note/tags', () => {
    const [row] = buildCommitRows([txn({ note: 'memo' })], ctx())
    expect(row).toMatchObject({
      user_id: USER,
      account_id: ACCOUNT,
      note: 'memo',
      tags: [],
      is_recurring: false,
      is_transfer: false,
    })
  })

  it('defaults a missing note to null', () => {
    const [row] = buildCommitRows([txn({})], ctx())
    expect(row?.note).toBeNull()
  })

  it('exposes a positive chunk size', () => {
    expect(CHUNK_SIZE).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- commit`
Expected: FAIL — `buildCommitRows` / `CHUNK_SIZE` not defined.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { RawTxn } from './adapter'
import { transactionFingerprint } from './fingerprint'

/**
 * Pure commit-row builder for the import flow (P2-08).
 *
 * The single place that knows the `transactions` insert shape for imports.
 * Mirrors `review.ts`'s `fingerprintOf` exactly so a committed row
 * re-fingerprints to the value `existingFingerprintsForAccount` recomputes —
 * that identity is what makes re-import idempotent. No I/O; fully unit-tested.
 */

/** Rows per chunk for the action's chunked idempotent upsert. */
export const CHUNK_SIZE = 500

export interface CommitContext {
  userId: string
  accountId: string
  /** Account currency (falling back to profile base) for rows without their own. */
  fallbackCurrency: string
  /** `category_id | null` per input row, index-aligned (from the seam). */
  categoryIds: (string | null)[]
}

/** The exact shape inserted into `transactions` for an imported row. */
export interface CommitRow {
  user_id: string
  account_id: string
  category_id: string | null
  amount_cents: number
  currency: string
  occurred_at: string
  description: string
  note: string | null
  tags: string[]
  is_recurring: boolean
  is_transfer: boolean
  import_fingerprint: string
}

export function buildCommitRows(
  newTxns: RawTxn[],
  ctx: CommitContext
): CommitRow[] {
  return newTxns.map((txn, i) => ({
    user_id: ctx.userId,
    account_id: ctx.accountId,
    category_id: ctx.categoryIds[i] ?? null,
    amount_cents: txn.amountCents,
    currency: txn.currency ?? ctx.fallbackCurrency,
    // UTC midnight: re-fingerprints identically to existingFingerprintsForAccount.
    occurred_at: `${txn.occurredAt}T00:00:00.000Z`,
    description: txn.description,
    note: txn.note ?? null,
    tags: [],
    is_recurring: false,
    is_transfer: false,
    import_fingerprint: transactionFingerprint({
      accountId: ctx.accountId,
      amountCents: txn.amountCents,
      description: txn.description,
      occurredAt: txn.occurredAt,
    }),
  }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- commit`
Expected: PASS (7 tests).

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add lib/domain/import/commit.ts lib/domain/import/commit.test.ts
git commit -m "feat(import): add pure commit-row builder (P2-08)"
```

---

### Task 3: `commitBatch` Server Action — `app/protected/import/actions.ts`

**Files:**
- Modify: `app/protected/import/actions.ts`

**Interfaces:**
- Consumes: `buildCommitRows`, `CHUNK_SIZE`, `CommitRow` from `@/lib/domain/import/commit`; `applyImportCategorization` from `@/lib/domain/import/categorize`; `existingFingerprintsForAccount` from `./data`; `reviewRows`/`ReviewRow` (already imported); `getBaseCurrency` from `@/app/protected/transactions/data`; the existing `decodeBytes`/`parseCsv`/`rowsToRecords` download path.
- Produces:
  - `type CommitActionResult = { ok: true; committed: number; skipped: number; failed: number } | { ok: false; error: string }`
  - `async function commitBatch(input: { batchId: string }): Promise<CommitActionResult>`

- [ ] **Step 1: Add the result type and error constant near the existing review exports**

After the `ReviewActionResult` type (around line 206), add:

```ts
const ALREADY_COMMITTED = 'alreadyCommitted'

export type CommitActionResult =
  | { ok: true; committed: number; skipped: number; failed: number }
  | { ok: false; error: string }
```

- [ ] **Step 2: Add imports at the top of the file**

In the import block (after the existing domain imports), add:

```ts
import { applyImportCategorization } from '@/lib/domain/import/categorize'
import {
  buildCommitRows,
  CHUNK_SIZE,
  type CommitRow,
} from '@/lib/domain/import/commit'
import { getBaseCurrency } from '@/app/protected/transactions/data'
```

- [ ] **Step 3: Append the `commitBatch` action at the end of the file**

```ts
/**
 * Commit a reviewed batch into real `transactions` rows (P2-08).
 *
 * Idempotent and partial-failure-tolerant: drives everything from the trusted
 * persisted batch (re-download, re-parse, re-classify), then writes via a
 * chunked upsert with `ON CONFLICT (user_id, import_fingerprint) DO NOTHING`.
 * Re-committing the same batch — or re-uploading the same file — inserts 0 rows.
 * A failed chunk doesn't abort the loop; a later re-run safely finishes the job.
 */
export async function commitBatch(input: {
  batchId: string
}): Promise<CommitActionResult> {
  const claims = await requireUser()
  const userId = claims.sub

  const supabase = await createClient()

  // 1. Load the batch (RLS scopes it to the caller).
  const { data: batch, error: batchErr } = await supabase
    .from('import_batches')
    .select('id, storage_path, status, account_id, mapping')
    .eq('id', input.batchId)
    .maybeSingle()
  if (batchErr || !batch) {
    return { ok: false, error: NOT_FOUND }
  }
  if (batch.status === 'committed') {
    return { ok: false, error: ALREADY_COMMITTED }
  }
  // Only a reviewed batch with a chosen account + mapping can be committed.
  const parsedMapping = columnMappingSchema.safeParse(batch.mapping)
  if (
    batch.status !== 'reviewed' ||
    !batch.account_id ||
    !batch.storage_path ||
    !parsedMapping.success
  ) {
    return { ok: false, error: VALIDATION_FAILED }
  }
  const accountId = batch.account_id as string

  // 2. Resolve the fallback currency: account currency, then profile base.
  const { data: account, error: accountErr } = await supabase
    .from('accounts')
    .select('currency')
    .eq('id', accountId)
    .maybeSingle()
  if (accountErr) {
    return { ok: false, error: UNEXPECTED }
  }
  if (!account) {
    return { ok: false, error: VALIDATION_FAILED }
  }
  const fallbackCurrency =
    (account.currency as string | null) ?? (await getBaseCurrency())

  // 3. Download + parse ALL rows (no sample cap), mirroring reviewBatch.
  let records: Record<string, string>[]
  try {
    const dl = await supabase.storage.from(BUCKET).download(batch.storage_path)
    if (dl.error || !dl.data) {
      return { ok: false, error: DOWNLOAD_FAILED }
    }
    const bytes = new Uint8Array(await dl.data.arrayBuffer())
    const { text } = decodeBytes(bytes)
    records = rowsToRecords(parseCsv(text))
  } catch {
    return { ok: false, error: UNEXPECTED }
  }

  // 4. Two-pass classify (same as reviewBatch): empty set to get the date
  //    range, then existing fingerprints for that range, then classify for real.
  const provisional = reviewRows(records, parsedMapping.data, accountId, new Set())
  const occurred = provisional.rows
    .filter(
      (r): r is ReviewRow & { txn: NonNullable<ReviewRow['txn']> } =>
        r.txn !== undefined
    )
    .map((r) => r.txn.occurredAt)
    .sort()
  const minDate = occurred[0] ?? '0001-01-01'
  const maxDate = occurred[occurred.length - 1] ?? '9999-12-31'
  const existing = await existingFingerprintsForAccount(
    accountId,
    minDate,
    maxDate
  )
  const result = reviewRows(records, parsedMapping.data, accountId, existing)

  const newTxns = result.rows
    .filter((r) => r.status === 'new' && r.txn !== undefined)
    .map((r) => r.txn as NonNullable<ReviewRow['txn']>)

  // 5. Auto-categorize (seam; empty rules ⇒ all null today — P3-03 fills it).
  const categoryIds = applyImportCategorization(newTxns, [])

  // 6. Build the insert rows.
  const rows: CommitRow[] = buildCommitRows(newTxns, {
    userId,
    accountId,
    fallbackCurrency,
    categoryIds,
  })

  // 7. Chunked idempotent upsert. Under ON CONFLICT DO NOTHING, .select()
  //    returns only newly-inserted rows; conflicts are silently skipped. A
  //    failed chunk is counted and skipped, not fatal — a retry is idempotent.
  let committed = 0
  let skipped = 0
  let failed = 0
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    const { data, error } = await supabase
      .from('transactions')
      .upsert(chunk, {
        onConflict: 'user_id,import_fingerprint',
        ignoreDuplicates: true,
      })
      .select('id')
    if (error) {
      failed += chunk.length
      continue
    }
    const inserted = data?.length ?? 0
    committed += inserted
    skipped += chunk.length - inserted
  }

  // 8. Persist the outcome on the batch.
  await supabase
    .from('import_batches')
    .update({
      status: failed > 0 ? 'failed' : 'committed',
      counts: { committed, skipped, failed },
      error: failed > 0 ? 'partialCommitFailure' : null,
    })
    .eq('id', input.batchId)

  // 9. Refresh the transactions list and the import page.
  revalidatePath('/protected/transactions')
  revalidatePath('/protected/import')

  return { ok: true, committed, skipped, failed }
}
```

- [ ] **Step 4: Add the `revalidatePath` import if missing**

Check the top of the file — if `revalidatePath` is not imported, add:

```ts
import { revalidatePath } from 'next/cache'
```

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS. (If `getBaseCurrency` is not exported from `app/protected/transactions/data.ts`, export it there.)

- [ ] **Step 6: Commit**

```bash
git add app/protected/import/actions.ts app/protected/transactions/data.ts
git commit -m "feat(import): add idempotent commitBatch server action (P2-08)"
```

---

### Task 4: Commit UI + i18n — `app/protected/import/ReviewPanel.tsx`

**Files:**
- Modify: `app/protected/import/ReviewPanel.tsx`
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Consumes: `commitBatch`, `CommitActionResult` from `./actions`.

- [ ] **Step 1: Add the `import.commit.*` keys to `messages/en.json`**

Inside the `import` object, replace the `commitBanner` line and add a `commit` block after `review`:

```json
  "commitBanner": "Review your import below, then commit when the counts look right.",
```

Add (sibling of `review`, before the top-level `errors`):

```json
  "commit": {
    "run": "Commit import",
    "running": "Committing…",
    "committed": "{count, plural, one {# transaction imported} other {# transactions imported}}",
    "skipped": "{count, plural, one {# duplicate skipped} other {# duplicates skipped}}",
    "failed": "{count, plural, one {# row failed — Commit again to retry} other {# rows failed — Commit again to retry}}",
    "viewTransactions": "View transactions",
    "errors": {
      "batchNotFound": "We couldn't find that upload. Please re-upload the file.",
      "downloadFailed": "We couldn't read the uploaded file. Please try again.",
      "validationFailed": "Review the import before committing.",
      "alreadyCommitted": "This import has already been committed.",
      "unexpected": "Something went wrong while committing. Please try again."
    }
  },
```

- [ ] **Step 2: Add the matching `import.commit.*` keys to `messages/es.json`**

```json
  "commitBanner": "Revisa tu importación abajo y confírmala cuando los totales sean correctos.",
```

```json
  "commit": {
    "run": "Confirmar importación",
    "running": "Confirmando…",
    "committed": "{count, plural, one {# transacción importada} other {# transacciones importadas}}",
    "skipped": "{count, plural, one {# duplicada omitida} other {# duplicadas omitidas}}",
    "failed": "{count, plural, one {# fila falló — confirma de nuevo para reintentar} other {# filas fallaron — confirma de nuevo para reintentar}}",
    "viewTransactions": "Ver transacciones",
    "errors": {
      "batchNotFound": "No encontramos esa subida. Vuelve a subir el archivo.",
      "downloadFailed": "No pudimos leer el archivo subido. Inténtalo de nuevo.",
      "validationFailed": "Revisa la importación antes de confirmarla.",
      "alreadyCommitted": "Esta importación ya se ha confirmado.",
      "unexpected": "Algo salió mal durante la confirmación. Inténtalo de nuevo."
    }
  },
```

- [ ] **Step 3: Run the i18n parity test to verify EN⇄ES keys match**

Run: `npm test -- i18n`
Expected: PASS (EN and ES have identical key sets).

- [ ] **Step 4: Wire the Commit button into `ReviewPanel.tsx`**

Update the import line:

```ts
import {
  type CommitActionResult,
  type ReviewActionResult,
  commitBatch,
  reviewBatch,
} from './actions'
```

Add commit state below the existing `result` state (after line 27):

```ts
  const [committing, setCommitting] = useState(false)
  const [commitResult, setCommitResult] = useState<CommitActionResult | null>(
    null
  )
```

Extend the invalidation effect (the `useEffect` clearing `result`) to also clear commit state:

```ts
  useEffect(() => {
    setResult(null)
    setCommitResult(null)
  }, [mapping, batchId])
```

Also clear `commitResult` wherever `setResult(null)` is called in the account `onChange` and in `onReview` (set it alongside).

Add the commit handler after `onReview`:

```ts
  async function onCommit() {
    setCommitting(true)
    setCommitResult(await commitBatch({ batchId }))
    setCommitting(false)
  }
```

Inside the `result?.ok ? (...)` block, after the preview `<ul>`, add the Commit affordance:

```tsx
            <div className="flex items-center gap-3 border-glass-line border-t pt-3">
              <Button
                type="button"
                onClick={onCommit}
                disabled={committing || result.counts.new === 0}
              >
                {committing ? t('commit.running') : t('commit.run')}
              </Button>
            </div>
            {commitResult && !commitResult.ok ? (
              <p className="text-neg text-sm">
                {t(`commit.errors.${commitResult.error}` as never)}
              </p>
            ) : null}
            {commitResult?.ok ? (
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex gap-4">
                  <span className="text-pos">
                    {t('commit.committed', { count: commitResult.committed })}
                  </span>
                  <span className="text-ink-soft">
                    {t('commit.skipped', { count: commitResult.skipped })}
                  </span>
                  {commitResult.failed > 0 ? (
                    <span className="text-neg">
                      {t('commit.failed', { count: commitResult.failed })}
                    </span>
                  ) : null}
                </div>
                <a
                  href="/protected/transactions"
                  className="text-brand-500 underline"
                >
                  {t('commit.viewTransactions')}
                </a>
              </div>
            ) : null}
```

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/protected/import/ReviewPanel.tsx messages/en.json messages/es.json
git commit -m "feat(import): add Commit button + commit i18n (P2-08)"
```

---

### Task 5: RLS idempotency test — `tests/rls/transactions.rls.test.ts`

**Files:**
- Modify: `tests/rls/transactions.rls.test.ts`

**Interfaces:**
- Consumes: existing `asUser`, `accountA`, `accountB`, `USER_A`, `USER_B`, `sql` harness.

- [ ] **Step 1: Add idempotency + per-user fingerprint tests**

Append these `it` blocks inside the `describe('transactions RLS', ...)` block (before its closing `})`):

```ts
  it('a second insert of the same import_fingerprint inserts 0 rows (idempotency)', async () => {
    await asUser(USER_A, async (tx) => {
      const fp = 'aaaa1111'
      const first = await tx`
        insert into public.transactions
          (user_id, account_id, amount_cents, currency, occurred_at, description, import_fingerprint)
        values
          (${USER_A}, ${accountA}, -4242, 'EUR', '2026-04-01T00:00:00.000Z', 'Idempotent', ${fp})
        on conflict (user_id, import_fingerprint) do nothing
        returning id`
      expect(first).toHaveLength(1)

      const second = await tx`
        insert into public.transactions
          (user_id, account_id, amount_cents, currency, occurred_at, description, import_fingerprint)
        values
          (${USER_A}, ${accountA}, -4242, 'EUR', '2026-04-01T00:00:00.000Z', 'Idempotent', ${fp})
        on conflict (user_id, import_fingerprint) do nothing
        returning id`
      expect(second).toHaveLength(0)

      await tx`delete from public.transactions where import_fingerprint = ${fp}`
    })
  })

  it('the partial unique index is per-user (A and B can hold the same fingerprint)', async () => {
    const fp = 'bbbb2222'
    const a = await asUser(USER_A, (tx) => tx`
      insert into public.transactions
        (user_id, account_id, amount_cents, currency, occurred_at, description, import_fingerprint)
      values
        (${USER_A}, ${accountA}, -100, 'EUR', '2026-04-02T00:00:00.000Z', 'Shared fp', ${fp})
      on conflict (user_id, import_fingerprint) do nothing
      returning id`)
    expect(a).toHaveLength(1)

    const b = await asUser(USER_B, (tx) => tx`
      insert into public.transactions
        (user_id, account_id, amount_cents, currency, occurred_at, description, import_fingerprint)
      values
        (${USER_B}, ${accountB}, -100, 'EUR', '2026-04-02T00:00:00.000Z', 'Shared fp', ${fp})
      on conflict (user_id, import_fingerprint) do nothing
      returning id`)
    expect(b).toHaveLength(1)

    await sql`delete from public.transactions where import_fingerprint = ${fp}`
  })
```

- [ ] **Step 2: Run the RLS suite (requires a disposable Postgres)**

Run: `TEST_DATABASE_URL="postgresql://...:5432/postgres" npm test -- rls`
Expected: PASS — including the two new tests. Without `TEST_DATABASE_URL` the suite is skipped (still green).

- [ ] **Step 3: Commit**

```bash
git add tests/rls/transactions.rls.test.ts
git commit -m "test(import): RLS idempotency + per-user fingerprint (P2-08)"
```

---

### Task 6: Board update + full verification

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Correct P2-01 stale status and mark P2-08**

In `PROGRESS.md`, set P2-01's status to DONE/REVIEW (it was already implemented and committed in `ee4bda1`), and mark P2-08 as done with an **Action required** note: manual browser verification (no migration — 0006 already applied).

- [ ] **Step 2: Run the full verification suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green. Confirm the new `categorize`, `commit`, and i18n-parity tests pass and the RLS suite is skipped (or passes with a DB URL).

- [ ] **Step 3: Commit**

```bash
git add PROGRESS.md
git commit -m "docs(p2-08): mark commit ticket done; correct P2-01 status"
```

- [ ] **Step 4: Action required (manual browser verification)**

No migration needed (0006 already applied). In the browser:
1. Upload a CSV → map columns → choose an account → Review.
2. Click **Commit** → rows appear in the transactions list; tally shows `committed: N, skipped: 0, failed: 0`.
3. Re-upload the same file → Review shows all rows as duplicates → Commit reports `committed: 0` → transactions list unchanged.

---

## Self-Review Notes

- **Spec coverage:** commitBatch action (Task 3), pure builder (Task 2), chunked idempotent upsert (Task 3 step 3), categorization seam (Task 1, invoked Task 3), Commit UI + status transition (Task 4), RLS idempotency + per-user (Task 5). Out-of-scope items (rules body, needs-review list, delete/retention, transfer detection, Excel) are not implemented — correct.
- **Type consistency:** `CommitContext.categoryIds` ↔ `applyImportCategorization` return `(string | null)[]`; `CommitRow` ↔ `transactions` insert shape from `transactions/actions.ts:124`; fingerprint inputs match `review.ts` `fingerprintOf`.
- **No placeholders:** every code/test step is complete. The `CategorizationRule` interface is intentionally an empty seam (documented), filled by P3-03 — not a plan placeholder.
