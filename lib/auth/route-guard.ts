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

export function resolveAuthRedirect(
  pathname: string,
  hasUser: boolean
): AuthRouteDecision {
  // Public confirmation page after account deletion (P5-02): the user is now
  // signed out, so it must be reachable without bouncing to login.
  if (pathname === '/goodbye') {
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
