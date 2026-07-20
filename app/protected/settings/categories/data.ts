import 'server-only'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import { type CategoryRow, categoryRowSchema } from '@/lib/validation/category'

/**
 * Read helpers for category management (P5-01). RLS-enforced: a user only ever
 * sees their own categories.
 */

/** Every category for the current user, flat (the page builds the tree). */
export async function listCategories(): Promise<CategoryRow[]> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }
  return categoryRowSchema.array().parse(data)
}
