import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * App-layer auth guard (P0-06), default-deny.
 *
 * Call at the top of any protected Server Component or Server Action. If there
 * is no valid session it redirects to login and never returns; otherwise it
 * returns the verified JWT claims (with `sub` = the user id).
 *
 * This is enforced IN ADDITION TO RLS, not instead of it — RLS is the database
 * backstop, this is the application gate. Belt and suspenders.
 */
export async function requireUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims) {
    redirect('/auth/login')
  }

  return data.claims
}
