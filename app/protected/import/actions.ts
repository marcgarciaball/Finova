'use server'

import { applyImportCategorization } from '@finova/domain/import/categorize'
import {
  buildCommitRows,
  CHUNK_SIZE,
  type CommitRow,
} from '@finova/domain/import/commit'
import {
  type ParseUploadData,
  type ParseUploadOutcome,
  parseExcelUpload,
  parseUploadBytes,
  recordsFromUpload,
} from '@finova/domain/import/parse-upload'
import { type ReviewRow, reviewRows } from '@finova/domain/import/review'
import { buildStoragePath, safeName } from '@finova/domain/import/storage-path'
import { validateUpload } from '@finova/domain/import/upload-file'
import type { Rule } from '@finova/domain/rules/types'
import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { getBaseCurrency } from '@/app/protected/transactions/data'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import {
  columnMappingSchema,
  type ImportTemplateRow,
  importTemplateRowSchema,
  saveTemplateSchema,
} from '@/lib/validation/import-template'
import {
  existingFingerprintsForAccount,
  listEnabledRulesForCategorization,
} from './data'

/**
 * Server Actions for the import flow.
 *
 * `uploadImport` (P2-01) validates an upload, stores the raw file in the private
 * per-user `imports` bucket, records an `import_batches` row, and parses the
 * bytes — all in one round trip. The file persists (re-read at commit, P2-08)
 * and the batch row is the source of truth for per-upload state. `saveTemplate`
 * (P2-03) upserts the column mapping as a reusable template.
 *
 * Both start with `requireUser()`, use the RLS-enforced server client, and derive
 * the owner from the verified JWT — never the form. **No transaction is ever
 * written here**; the flow stops at preview.
 */

const VALIDATION_FAILED = 'validationFailed'
const UNEXPECTED = 'unexpected'
const NO_FILE = 'noFile'
const STORAGE_FAILED = 'storageFailed'
const BUCKET = 'imports'

export type ParseResult =
  | {
      ok: true
      batchId: string
      data: ParseUploadData
      template: ImportTemplateRow | null
    }
  | { ok: false; error: string }

export type SaveResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !(key in out)) {
      out[key] = issue.message
    }
  }
  return out
}

export async function uploadImport(
  _prev: ParseResult | undefined,
  formData: FormData
): Promise<ParseResult> {
  const claims = await requireUser()
  const userId = claims.sub

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return { ok: false, error: NO_FILE }
  }

  const valid = validateUpload({
    name: file.name,
    size: file.size,
    type: file.type,
  })
  if (!valid.ok) {
    return { ok: false, error: valid.error }
  }

  const batchId = crypto.randomUUID()
  const path = buildStoragePath(userId, batchId, file.name)

  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch {
    return { ok: false, error: UNEXPECTED }
  }

  const supabase = await createClient()

  // 1. Store the raw file. contentType comes from the extension, not the
  //    browser, so odd MIME values don't taint the stored object.
  const upload = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: valid.contentType, upsert: false })
  if (upload.error) {
    return { ok: false, error: STORAGE_FAILED }
  }

  // 2. Record the batch. If this fails after a successful upload, best-effort
  //    delete the now-orphaned object so the bucket doesn't accumulate junk.
  // Pin the row id to the same UUID used for the storage path, so the batchId
  // returned to the client matches the row that review/commit later look up.
  // (Without an explicit id the DB default generates a *different* uuid, and
  // every review/commit then fails with "batch not found".)
  const insert = await supabase.from('import_batches').insert({
    id: batchId,
    user_id: userId,
    storage_path: path,
    filename: safeName(file.name),
    mime_type: valid.contentType,
    byte_size: file.size,
    status: 'uploaded',
  })
  if (insert.error) {
    await supabase.storage.from(BUCKET).remove([path])
    return { ok: false, error: UNEXPECTED }
  }

  // 3. Parse the same bytes (no second download). Excel goes through the
  //    workbook reader; CSV through the text parser — both yield identical data.
  let outcome: ParseUploadOutcome
  try {
    outcome =
      valid.kind === 'excel'
        ? await parseExcelUpload(file.name, bytes)
        : parseUploadBytes(file.name, bytes)
  } catch {
    return { ok: false, error: UNEXPECTED }
  }
  if (!outcome.ok) {
    return { ok: false, error: outcome.error }
  }

  // 5. Pre-fill from a saved template for this exact layout, if one exists.
  try {
    const { data } = await supabase
      .from('import_templates')
      .select('*')
      .eq('header_signature', outcome.data.signature)
      .maybeSingle()
    const template = data ? importTemplateRowSchema.parse(data) : null
    return { ok: true, batchId, data: outcome.data, template }
  } catch {
    // A template-lookup failure must not block parsing; map with no pre-fill.
    return { ok: true, batchId, data: outcome.data, template: null }
  }
}

export async function saveTemplate(input: {
  name: string
  signature: string
  mapping: unknown
}): Promise<SaveResult> {
  const claims = await requireUser()

  const parsed = saveTemplateSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: VALIDATION_FAILED,
      fieldErrors: toFieldErrors(parsed.error),
    }
  }

  try {
    const supabase = await createClient()
    // One template per (user, layout): upsert on the unique signature key.
    const { error } = await supabase.from('import_templates').upsert(
      {
        user_id: claims.sub,
        header_signature: parsed.data.signature,
        name: parsed.data.name,
        mapping: parsed.data.mapping,
      },
      { onConflict: 'user_id,header_signature' }
    )
    if (error) {
      return { ok: false, error: UNEXPECTED }
    }
  } catch {
    return { ok: false, error: UNEXPECTED }
  }

  return { ok: true }
}

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

const ALREADY_COMMITTED = 'alreadyCommitted'

export type CommitActionResult =
  | { ok: true; committed: number; skipped: number; failed: number }
  | { ok: false; error: string }

export async function reviewBatch(input: {
  batchId: string
  accountId: string
  mapping: unknown
}): Promise<ReviewActionResult> {
  await requireUser()

  const parsedMapping = columnMappingSchema.safeParse(input.mapping)
  if (!parsedMapping.success) {
    return { ok: false, error: VALIDATION_FAILED }
  }

  const supabase = await createClient()

  // 1. Load the batch (RLS scopes it to the caller).
  const { data: batch, error: batchErr } = await supabase
    .from('import_batches')
    .select('id, storage_path, status, filename')
    .eq('id', input.batchId)
    .maybeSingle()
  if (batchErr || !batch) {
    return { ok: false, error: NOT_FOUND }
  }
  // A committed or failed batch is past review; don't reopen it.
  if (!['uploaded', 'mapped', 'reviewed'].includes(batch.status)) {
    return { ok: false, error: VALIDATION_FAILED }
  }

  // 2. Verify the chosen account belongs to the caller.
  const { data: account, error: accountErr } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', input.accountId)
    .maybeSingle()
  if (accountErr) {
    return { ok: false, error: UNEXPECTED }
  }
  if (!account) {
    return { ok: false, error: VALIDATION_FAILED }
  }

  // 3. Download + parse ALL rows (no sample cap on the count path).
  if (!batch.storage_path) {
    return { ok: false, error: NOT_FOUND }
  }
  let records: Record<string, string>[]
  try {
    const dl = await supabase.storage.from(BUCKET).download(batch.storage_path)
    if (dl.error || !dl.data) {
      return { ok: false, error: DOWNLOAD_FAILED }
    }
    const bytes = new Uint8Array(await dl.data.arrayBuffer())
    records = await recordsFromUpload(batch.filename ?? '', bytes)
  } catch {
    return { ok: false, error: UNEXPECTED }
  }

  // 4. Two-pass classify: first with an empty set to extract the date range,
  //    then fetch existing fingerprints for that range, then classify for real.
  const provisional = reviewRows(
    records,
    parsedMapping.data,
    input.accountId,
    new Set()
  )
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
    input.accountId,
    minDate,
    maxDate
  )
  const result = reviewRows(
    records,
    parsedMapping.data,
    input.accountId,
    existing
  )

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
    .select('id, storage_path, status, account_id, mapping, filename')
    .eq('id', input.batchId)
    .maybeSingle()
  if (batchErr || !batch) {
    return { ok: false, error: NOT_FOUND }
  }
  if (batch.status === 'committed') {
    return { ok: false, error: ALREADY_COMMITTED }
  }
  // Only a reviewed (or previously failed) batch with a chosen account +
  // mapping can be committed. A 'failed' batch is re-committable because the
  // upsert is idempotent (ON CONFLICT DO NOTHING); a partial failure is safely
  // retried and will only insert the rows that did not go through previously.
  const parsedMapping = columnMappingSchema.safeParse(batch.mapping)
  if (
    !['reviewed', 'failed'].includes(batch.status) ||
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
  let fallbackCurrency: string
  try {
    fallbackCurrency =
      (account.currency as string | null) ?? (await getBaseCurrency())
  } catch {
    return { ok: false, error: UNEXPECTED }
  }

  // 3. Download + parse ALL rows (no sample cap), mirroring reviewBatch.
  let records: Record<string, string>[]
  try {
    const dl = await supabase.storage.from(BUCKET).download(batch.storage_path)
    if (dl.error || !dl.data) {
      return { ok: false, error: DOWNLOAD_FAILED }
    }
    const bytes = new Uint8Array(await dl.data.arrayBuffer())
    records = await recordsFromUpload(batch.filename ?? '', bytes)
  } catch {
    return { ok: false, error: UNEXPECTED }
  }

  // 4. Two-pass classify (same as reviewBatch): empty set to get the date
  //    range, then existing fingerprints for that range, then classify for real.
  const provisional = reviewRows(
    records,
    parsedMapping.data,
    accountId,
    new Set()
  )
  const occurred = provisional.rows
    .filter(
      (r): r is ReviewRow & { txn: NonNullable<ReviewRow['txn']> } =>
        r.txn !== undefined
    )
    .map((r) => r.txn.occurredAt)
    .sort()
  const minDate = occurred[0] ?? '0001-01-01'
  const maxDate = occurred[occurred.length - 1] ?? '9999-12-31'
  let existing: Set<string>
  try {
    existing = await existingFingerprintsForAccount(accountId, minDate, maxDate)
  } catch {
    return { ok: false, error: UNEXPECTED }
  }
  const result = reviewRows(records, parsedMapping.data, accountId, existing)

  const newTxns = result.rows
    .filter((r) => r.status === 'new' && r.txn !== undefined)
    .map((r) => r.txn as NonNullable<ReviewRow['txn']>)

  // 5. Auto-categorize via the user's enabled rules (P3-03). Rules failing to
  //    load degrades to uncategorized — categorization enhances, never blocks,
  //    a commit. All rows in the batch share `accountId`.
  let rules: Rule[] = []
  try {
    rules = await listEnabledRulesForCategorization()
  } catch {
    rules = []
  }
  const categoryIds = applyImportCategorization(newTxns, rules, accountId)

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

  // 9. Refresh the transactions list and the data (import/export) page.
  revalidatePath('/protected/transactions')
  revalidatePath('/protected/data')

  return { ok: true, committed, skipped, failed }
}
