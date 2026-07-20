import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getClientEnv } from '@/lib/validation/env'
import { getServerEnv } from '@/lib/validation/env.server'

/**
 * Service-role Supabase client (Inversiones A1). Bypasses RLS — the ONLY
 * legitimate writer of the shared market-reference tables (assets,
 * cached_quotes, historical_prices, dividend_events, fx_rates) and the
 * derived tables (holdings, portfolio_snapshots), which have no user write
 * policies at all. Server-only by import; never cache in a module global.
 */
export function createAdminClient() {
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv()
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set — required for investment data writes'
    )
  }
  const env = getClientEnv()
  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
