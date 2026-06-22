/**
 * i18n configuration (P0-09).
 *
 * Finova is a private single-user app, so locale is a user *preference*, not a
 * URL concern — we use next-intl WITHOUT i18n routing. The active locale is
 * read from a cookie (and, for signed-in users, mirrored from profiles.locale).
 * See ADR-004 (revised) in DECISIONS.md.
 */
export const locales = ['es', 'en'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'es'

/** Cookie next-intl reads the active locale from. */
export const LOCALE_COOKIE = 'NEXT_LOCALE'

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' && (locales as readonly string[]).includes(value)
  )
}
