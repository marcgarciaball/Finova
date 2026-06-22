import 'server-only'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@/lib/db/schema'
import { getServerEnv } from '@/lib/validation/env.server'

/**
 * Drizzle database client (P0-07), server-only.
 *
 * Uses the Supabase **pooled** connection (DATABASE_URL, port 6543). Created
 * lazily and memoized so importing this module has no side effects and the
 * connection is only opened when first queried.
 *
 * NOTE: this client connects as the database owner and therefore BYPASSES RLS.
 * It is for trusted server-side code (migrations-adjacent admin work, Server
 * Actions that have already authorized the caller). User-scoped reads/writes
 * should still go through the Supabase client so RLS applies — RLS remains the
 * backstop, never the only line of defense.
 */
let cached: ReturnType<typeof drizzle<typeof schema>> | undefined

export function getDb() {
  if (!cached) {
    const { DATABASE_URL } = getServerEnv()
    if (!DATABASE_URL) {
      throw new Error(
        'DATABASE_URL is not set. Add the Supabase pooled connection string to .env.local (see .env.example).'
      )
    }
    // prepare:false is required for the Supabase transaction pooler (pgbouncer).
    const sql = postgres(DATABASE_URL, { prepare: false })
    cached = drizzle(sql, { schema })
  }
  return cached
}
