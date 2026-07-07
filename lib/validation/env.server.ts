import 'server-only'
import { z } from 'zod'
import { parseEnv } from '@/lib/validation/env'

/**
 * Server-only environment (P0-03). The `server-only` import makes any attempt
 * to bundle this into client code a build error, so these secrets can never
 * leak to the browser.
 *
 * The database/service-role vars are optional for now and become required when
 * P0-07 (Drizzle + Supabase service usage) lands; until then the app boots with
 * only the public Supabase vars set.
 */
export const serverEnvSchema = z.object({
  CRON_SECRET: z.string().min(10).optional(),
  FINNHUB_API_KEY: z.string().min(1).optional(),
  FMP_API_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10).optional(),
  DATABASE_URL: z.url().optional(),
  DIRECT_URL: z.url().optional(),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

let cachedServerEnv: ServerEnv | undefined

/** Validated server-only env, parsed on first use and memoized. */
export function getServerEnv(): ServerEnv {
  if (!cachedServerEnv) {
    cachedServerEnv = parseEnv(serverEnvSchema, process.env, 'server')
  }
  return cachedServerEnv
}
