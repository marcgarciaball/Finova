import 'server-only'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import {
  type ImportTemplateRow,
  importTemplateRowSchema,
} from '@/lib/validation/import-template'

/**
 * Read helpers for import templates (P2-03). All reads go through the
 * RLS-enforced Supabase server client, so a user only ever sees their own
 * templates. Lookups are by the file's header signature (the template key).
 */

/** The caller's saved template for this layout, or null when none exists. */
export async function findTemplateBySignature(
  signature: string
): Promise<ImportTemplateRow | null> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('import_templates')
    .select('*')
    .eq('header_signature', signature)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  return data ? importTemplateRowSchema.parse(data) : null
}

/** All of the caller's saved templates, newest first. */
export async function listTemplates(): Promise<ImportTemplateRow[]> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('import_templates')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }
  return importTemplateRowSchema.array().parse(data)
}
