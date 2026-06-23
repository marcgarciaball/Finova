'use server'

import type { z } from 'zod'
import { requireUser } from '@/lib/auth/require-user'
import {
  type ParseUploadData,
  parseUploadBytes,
} from '@/lib/domain/import/parse-upload'
import { createClient } from '@/lib/supabase/server'
import {
  type ImportTemplateRow,
  importTemplateRowSchema,
  saveTemplateSchema,
} from '@/lib/validation/import-template'

/**
 * Server Actions for the import flow (P2-03): parse an uploaded CSV (transient,
 * via FormData — no storage bucket until P2-01) and save/upsert the column
 * mapping as a reusable template. Both start with `requireUser()`, use the
 * RLS-enforced server client, and derive the owner from the verified JWT — never
 * the form. **No transaction is ever written here**; the flow stops at preview.
 */

const VALIDATION_FAILED = 'validationFailed'
const UNEXPECTED = 'unexpected'
const NO_FILE = 'noFile'

export type ParseResult =
  | { ok: true; data: ParseUploadData; template: ImportTemplateRow | null }
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

export async function parseUpload(
  _prev: ParseResult | undefined,
  formData: FormData
): Promise<ParseResult> {
  await requireUser()

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: NO_FILE }
  }

  let outcome: ReturnType<typeof parseUploadBytes>
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    outcome = parseUploadBytes(file.name, bytes)
  } catch {
    return { ok: false, error: UNEXPECTED }
  }
  if (!outcome.ok) {
    return { ok: false, error: outcome.error }
  }

  // Pre-fill from a saved template for this exact layout, if one exists.
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('import_templates')
      .select('*')
      .eq('header_signature', outcome.data.signature)
      .maybeSingle()
    const template = data ? importTemplateRowSchema.parse(data) : null
    return { ok: true, data: outcome.data, template }
  } catch {
    // A template-lookup failure must not block parsing; map with no pre-fill.
    return { ok: true, data: outcome.data, template: null }
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
