import { NextResponse } from 'next/server'
import { z } from 'zod'
import { captureError } from '@/lib/observability/capture-error'

/**
 * Client-error reporting endpoint (P5-05) — the browser-side counterpart to
 * `instrumentation.ts#onRequestError` (server errors). `app/error.tsx` and
 * `app/global-error.tsx` POST here so render errors caught by React's error
 * boundary also reach `error_logs`, not just the browser console.
 * Unauthenticated by necessity (a crashed page may have no session); the
 * schema caps every field so a malicious payload can't bloat the table.
 */
const bodySchema = z.object({
  digest: z.string().max(100).optional(),
  message: z.string().min(1).max(500),
  path: z.string().max(500).optional(),
  stack: z.string().max(4000).optional(),
})

export async function POST(request: Request) {
  const json = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  const { message, stack, digest, path } = parsed.data
  const error = new Error(message)
  if (stack) {
    error.stack = stack
  }
  await captureError(error, { digest, path, source: 'client' })
  return NextResponse.json({ ok: true })
}
