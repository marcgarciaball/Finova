import { z } from 'zod'

/**
 * Environment validation (P0-03).
 *
 * One source of truth for env vars. Validated with Zod so a missing or
 * malformed variable fails fast with a clear message instead of surfacing as a
 * cryptic runtime error deep inside a library call.
 *
 * This module is side-effect free: importing it never reads `process.env`.
 * The validated values are exposed through lazy getters, so tests (and any
 * context without env set) can import the schema and `parseEnv` freely.
 *
 * Client vars (NEXT_PUBLIC_*) are inlined by Next into the browser bundle and
 * are safe to expose. Server-only secrets live in `env.server.ts`, guarded by
 * `server-only` so they can never be imported into client code.
 */

/** Vars available in both server and browser. Safe to expose. */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    message: 'must be a full URL, e.g. https://<ref>.supabase.co',
  }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(10, { message: 'looks too short to be a valid key' }),
  NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),
})

export type ClientEnv = z.infer<typeof clientEnvSchema>

/**
 * Parse a source object against a schema, throwing a single readable error
 * that lists every problem at once. Pure — unit-tested directly.
 */
export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, unknown>,
  scope: string
): z.infer<T> {
  const result = schema.safeParse(source)
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const key = issue.path.join('.') || '(root)'
        return `  • ${key}: ${issue.message}`
      })
      .join('\n')
    throw new Error(
      `Invalid ${scope} environment variables:\n${details}\n\n` +
        'Check your .env.local against .env.example.'
    )
  }
  return result.data
}

let cachedClientEnv: ClientEnv | undefined

/**
 * Validated client env, parsed on first use and memoized. Each `process.env`
 * member is referenced statically so Next can inline it into the client bundle.
 */
export function getClientEnv(): ClientEnv {
  if (!cachedClientEnv) {
    cachedClientEnv = parseEnv(
      clientEnvSchema,
      {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      },
      'client'
    )
  }
  return cachedClientEnv
}
