/**
 * Pure auth routing decision (P1 auth/session fix).
 *
 * Extracted from the proxy so the redirect matrix — logged-out users bounced
 * to login, logged-in users bounced off the marketing home + login pages —
 * is unit-testable without spinning up a Next request/response cycle.
 */
import { DEFAULT_REDIRECT } from '@/lib/auth/redirect'

export type AuthRouteDecision =
  | { type: 'allow' }
  | { type: 'redirect'; path: string }

const LOGIN_PATH = '/auth/login'

/**
 * Always-public pages, reachable regardless of auth state: the post-deletion
 * confirmation (P5-02) and the legal pages (P5-07). A signed-out user must be
 * able to read these without being bounced to login.
 */
const PUBLIC_PATHS = new Set(['/goodbye', '/privacy', '/terms'])

export function resolveAuthRedirect(
  pathname: string,
  hasUser: boolean
): AuthRouteDecision {
  // API routes handle their own auth (bearer token, or none by design) —
  // a session-cookie redirect here would make cron/service callers
  // unreachable, since they never carry a browser session.
  if (pathname.startsWith('/api/')) {
    return { type: 'allow' }
  }
  if (PUBLIC_PATHS.has(pathname)) {
    return { type: 'allow' }
  }

  const isHome = pathname === '/'
  const isAuthRoute = pathname.startsWith('/auth')

  if (hasUser) {
    if (isHome || pathname === LOGIN_PATH) {
      return { type: 'redirect', path: DEFAULT_REDIRECT }
    }
    return { type: 'allow' }
  }

  if (isHome || isAuthRoute) {
    return { type: 'allow' }
  }
  return { type: 'redirect', path: LOGIN_PATH }
}
