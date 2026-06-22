import type { EmailOtpType } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { type NextRequest, NextResponse } from 'next/server'
import { authTokenRateLimiter, clientIp } from '@/lib/auth/rate-limit'
import { safeRedirectPath } from '@/lib/auth/redirect'
import { createClient } from '@/lib/supabase/server'

/**
 * Magic-link / email OTP verification (PKCE). Hardened (P0-05/P0-11):
 *  - rate-limited per IP to stop token brute-forcing,
 *  - `next` validated through the same-origin allowlist (no open redirect),
 *  - error messages URL-encoded.
 */
export async function GET(request: NextRequest) {
  if (!authTokenRateLimiter(clientIp(request)).success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeRedirectPath(searchParams.get('next'))

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      redirect(next)
    }
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`)
  }

  redirect('/auth/error?error=No+token+hash+or+type')
}
