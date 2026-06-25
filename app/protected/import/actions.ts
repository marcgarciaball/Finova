'use server'

import type { z } from 'zod'
import { requireUser } from '@/lib/auth/require-user'
import { parseCsv, rowsToRecords } from '@/lib/domain/import/csv'
import { decodeBytes } from '@/lib/domain/import/encoding'
import {
  type ParseUploadData,
  parseUploadBytes,
} from '@/lib/domain/import/parse-upload'
import { type ReviewRow, reviewRows } from '@/lib/domain/import/review'
import { buildStoragePath, safeName } from '@/lib/domain/import/storage-path'
import { validateUpload } from '@/lib/domain/import/upload-file'
import { createClient } from '@/lib/supabase/server'
import {
  columnMappingSchema,
  type ImportTemplateRow,
  importTemplateRowSchema,
  saveTemplateSchema,
} from '@/lib/validation/import-template'
import { existingFingerprintsForAccount } from './data'

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
const EXCEL_NOT_SUPPORTED = 'excelNotSupported'
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
  const insert = await supabase.from('import_batches').insert({
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

  // 3. Excel uploads are stored but not yet parsed (P2-03 deferral); the file
  //    and batch persist so a future ticket can parse them.
  if (valid.kind === 'excel') {
    return { ok: false, error: EXCEL_NOT_SUPPORTED }
  }

  // 4. Parse the same bytes (no second download).
  let outcome: ReturnType<typeof parseUploadBytes>
  try {
    outcome = parseUploadBytes(file.name, bytes)
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
    .select('id, storage_path, status')
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
    const { text } = decodeBytes(bytes)
    const parsed = parseCsv(text)
    records = rowsToRecords(parsed)
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
