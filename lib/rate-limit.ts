/**
 * Minimal in-memory fixed-window rate limiter (P0-11).
 *
 * Used to throttle the auth token endpoints we control (`/auth/confirm`,
 * `/auth/callback`) against brute-forcing. Password/magic-link auth itself runs
 * client→Supabase directly, where Supabase enforces its own limits.
 *
 * LIMITATION: state is per-process (in-memory), so it resets on redeploy and is
 * not shared across instances. That's fine for a single-user MVP; for multi-
 * instance production, swap the Map for a shared store (e.g. Upstash/Redis).
 * Tracked for the P5-05 security audit.
 */
export interface RateLimitResult {
  remaining: number
  resetAt: number
  success: boolean
}

interface Bucket {
  count: number
  resetAt: number
}

export function createRateLimiter({
  limit,
  windowMs,
}: {
  limit: number
  windowMs: number
}) {
  const buckets = new Map<string, Bucket>()

  return function check(
    key: string,
    now: number = Date.now()
  ): RateLimitResult {
    const bucket = buckets.get(key)

    if (!bucket || now >= bucket.resetAt) {
      const resetAt = now + windowMs
      buckets.set(key, { count: 1, resetAt })
      return { success: true, remaining: limit - 1, resetAt }
    }

    if (bucket.count >= limit) {
      return { success: false, remaining: 0, resetAt: bucket.resetAt }
    }

    bucket.count += 1
    return {
      success: true,
      remaining: limit - bucket.count,
      resetAt: bucket.resetAt,
    }
  }
}
