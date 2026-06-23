'use server'

import type { z } from 'zod'
import { requireUser } from '@/lib/auth/require-user'
import {
  type ParseUploadData,
  parseUploadBytes,
} from '@/lib/domain/import/parse-upload'
import { buildStoragePath, safeName } from '@/lib/domain/import/storage-path'
import { validateUpload } from '@/lib/domain/import/upload-file'
import { createClient } from '@/lib/supabase/server'
import {
  type ImportTemplateRow,
  importTemplateRowSchema,
  saveTemplateSchema,
} from '@/lib/validation/import-template'

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
