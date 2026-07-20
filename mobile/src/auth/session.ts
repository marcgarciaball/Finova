import type { Session } from '@supabase/supabase-js'

/** True if the session exists and its access token hasn't expired yet. */
export function isSessionValid(session: Session | null): boolean {
  if (!session) {
    return false
  }
  if (session.expires_at === undefined) {
    return true
  }
  return session.expires_at * 1000 > Date.now()
}
