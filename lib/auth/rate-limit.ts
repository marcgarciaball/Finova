import 'server-only'
import { createRateLimiter } from '@/lib/rate-limit'

/**
 * Shared limiter for the auth token endpoints we control (P0-11).
 * 10 requests / minute / IP is generous for a human clicking an email link but
 * stops automated token brute-forcing.
 */
export const authTokenRateLimiter = createRateLimiter({
  limit: 10,
  windowMs: 60_000,
})

/** Best-effort client IP from proxy headers; falls back to a constant. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown'
  return request.headers.get('x-real-ip') ?? 'unknown'
}
