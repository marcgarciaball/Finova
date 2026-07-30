'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  type ActionResult,
  toFieldErrors,
  UNEXPECTED,
  VALIDATION_FAILED,
} from '@/lib/validation/form'
import {
  emailConfirmationMatches,
  updateProfileSchema,
} from '@/lib/validation/profile'

export type { ActionResult }

const SETTINGS_PATH = '/protected/settings'
const IMPORTS_BUCKET = 'imports'
const CONFIRM_MISMATCH = 'confirmationMismatch'

/**
 * Update the caller's currency preferences (P5-01). Language and theme are owned
 * by their own switchers, so they are not touched here. Owner is the JWT `sub`;
 * RLS additionally scopes the update to the caller's row.
 */
export async function updateProfile(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const claims = await requireUser()

  const parsed = updateProfileSchema.safeParse({
    baseCurrency: formData.get('baseCurrency'),
    displayCurrency: formData.get('displayCurrency'),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: VALIDATION_FAILED,
      fieldErrors: toFieldErrors(parsed.error),
    }
  }

  try {
    const supabase = await createClient()
    // Upsert so a user whose profile row predates the signup trigger still gets
    // their preferences saved; RLS + the PK on `id` keep it the caller's row.
    const { error } = await supabase.from('profiles').upsert(
      {
        id: claims.sub,
        base_currency: parsed.data.baseCurrency,
        display_currency: parsed.data.displayCurrency,
      },
      { onConflict: 'id' }
    )
    if (error) {
      return { ok: false, error: UNEXPECTED }
    }
  } catch {
    return { ok: false, error: UNEXPECTED }
  }

  revalidatePath(SETTINGS_PATH)
  revalidatePath('/protected')
  return { ok: true }
}

/**
 * Permanently delete the caller's account and all data (P5-02, GDPR erasure).
 *
 * The user confirms by typing their own email. On match we purge their Storage
 * objects (not FK-cascaded), then delete the auth user via the service-role
 * client — every user-owned table is `ON DELETE cascade` from `auth.users`, so
 * one call erases everything. Finally we clear the session and redirect to a
 * public goodbye page. Irreversible; there is no grace period by design.
 */
export async function deleteAccount(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const claims = await requireUser()
  const email = typeof claims.email === 'string' ? claims.email : ''
  const confirmation = String(formData.get('confirmation') ?? '')

  if (!emailConfirmationMatches(confirmation, email)) {
    return { ok: false, error: CONFIRM_MISMATCH }
  }

  let deleted = false
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    // 1. Purge Storage — enumerate the user's objects via import_batches
    //    (RLS-scoped) rather than a fragile recursive listing. Best-effort:
    //    a storage failure must not block the actual erasure.
    const { data: batches } = await supabase
      .from('import_batches')
      .select('storage_path')
    const paths = (batches ?? []).flatMap((b) =>
      typeof b.storage_path === 'string' && b.storage_path.length > 0
        ? [b.storage_path]
        : []
    )
    if (paths.length > 0) {
      await admin.storage.from(IMPORTS_BUCKET).remove(paths)
    }

    // 2. Hard-delete the auth user → cascades every owned row.
    const { error } = await admin.auth.admin.deleteUser(claims.sub)
    if (error) {
      return { ok: false, error: UNEXPECTED }
    }
    deleted = true

    // 3. Clear the (now-orphaned) session cookies. Best-effort.
    try {
      await supabase.auth.signOut()
    } catch {
      // The user is already gone; a failed sign-out doesn't undo deletion.
    }
  } catch {
    if (!deleted) {
      return { ok: false, error: UNEXPECTED }
    }
  }

  // Outside the try: redirect() throws NEXT_REDIRECT by design.
  redirect('/goodbye')
}
