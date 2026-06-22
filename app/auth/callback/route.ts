import { type NextRequest, NextResponse } from 'next/server'
import { authTokenRateLimiter, clientIp } from '@/lib/auth/rate-limit'
import { safeRedirectPath } from '@/lib/auth/redirect'
import { createClient } from '@/lib/supabase/server'

/**
 * OAuth / PKCE code-exchange callback (P0-05). Used by Google sign-in and any
 * provider that returns an authorization `code`. Hardened the same way as the
 * email confirm route: rate-limited, and the post-login `next` is validated
 * through the same-origin allowlist so it can never bounce off-site.
 *
 * Google is not wired up until the provider is configured in the Supabase
 * dashboard, but the callback is ready and hardened for when it is.
 */
export async function GET(request: NextRequest) {
  if (!authTokenRateLimiter(clientIp(request)).success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeRedirectPath(searchParams.get('next'))

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error?error=No+code+provided`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/error?error=${encodeURIComponent(error.message)}`
    )
  }

  return NextResponse.redirect(`${origin}${next}`)
}
