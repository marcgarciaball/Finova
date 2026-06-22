/**
 * Safe redirect handling (P0-05).
 *
 * Auth flows accept a `next` parameter so users land where they intended after
 * sign-in. Passing that value straight to a redirect is an open-redirect
 * vulnerability — an attacker can craft `?next=https://evil.com` and use your
 * trusted domain to bounce victims to a phishing page.
 *
 * `safeRedirectPath` allows ONLY same-origin paths: it rejects absolute URLs,
 * protocol-relative URLs (`//evil.com`), and backslash tricks, falling back to
 * a known-safe internal path. Pure + unit-tested.
 */
export const DEFAULT_REDIRECT = '/protected'

export function safeRedirectPath(
  next: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT
): string {
  if (typeof next !== 'string' || next.length === 0) return fallback

  // Must be an absolute path on this origin. Reject anything that could point
  // off-site: "//host", "/\host", "https://host", "javascript:", etc.
  if (!next.startsWith('/')) return fallback
  if (next.startsWith('//') || next.startsWith('/\\')) return fallback

  try {
    // Resolve against a placeholder origin; if the host changes, it escaped.
    const url = new URL(next, 'http://localhost')
    if (url.origin !== 'http://localhost') return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}
