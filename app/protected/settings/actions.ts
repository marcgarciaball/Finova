'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import {
  type ActionResult,
  toFieldErrors,
  UNEXPECTED,
  VALIDATION_FAILED,
} from '@/lib/validation/form'
import { updateProfileSchema } from '@/lib/validation/profile'

export type { ActionResult }

const SETTINGS_PATH = '/protected/settings'

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
