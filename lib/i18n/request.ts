import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { defaultLocale, isLocale, LOCALE_COOKIE } from './config'

/**
 * Per-request i18n config (P0-09). Resolves the active locale from the cookie,
 * falling back to the default, and loads that locale's message catalog.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(LOCALE_COOKIE)?.value
  const locale = isLocale(cookieValue) ? cookieValue : defaultLocale

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
