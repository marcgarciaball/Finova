'use server'

import { cookies } from 'next/headers'
import { isLocale, LOCALE_COOKIE, type Locale } from './config'

/**
 * Persist the chosen locale to the cookie (P0-09). The caller refreshes the
 * router afterward so Server Components re-render in the new language.
 *
 * Validates against the allowed locale set — never trust the client value.
 */
export async function setLocale(locale: Locale) {
  if (!isLocale(locale)) return
  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
}
