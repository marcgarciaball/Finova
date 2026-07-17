import 'server-only'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import { type ProfileRow, profileRowSchema } from '@/lib/validation/profile'

/**
 * Read helpers for the Settings surface (P5-01). RLS-enforced: a user only ever
 * sees their own profile row (`id = auth.uid()`).
 */

/**
 * The caller's profile. Every auth user gets one via the signup trigger, but we
 * fall back to sane defaults (EUR/EUR/es) if the row is somehow absent so the
 * form always renders.
 */
export async function getProfile(): Promise<
  Pick<ProfileRow, 'base_currency' | 'display_currency' | 'locale'>
> {
  const claims = await requireUser()
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('*').maybeSingle()

  if (!data) {
    return { base_currency: 'EUR', display_currency: 'EUR', locale: 'es' }
  }
  const row = profileRowSchema.parse({ ...data, id: data.id ?? claims.sub })
  return {
    base_currency: row.base_currency,
    display_currency: row.display_currency,
    locale: row.locale,
  }
}
