import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

/**
 * Site footer (P5-07): the "not financial advice" disclaimer plus links to the
 * legal pages. Server component — pure content, no interactivity.
 */
export async function SiteFooter() {
  const t = await getTranslations('legal')

  return (
    <footer className="w-full border-glass-line border-t">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 p-5 text-ink-soft text-xs sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-prose">{t('disclaimer')}</p>
        <nav className="flex shrink-0 gap-4" aria-label={t('footerPrivacy')}>
          <Link href="/privacy" className="hover:text-ink">
            {t('footerPrivacy')}
          </Link>
          <Link href="/terms" className="hover:text-ink">
            {t('footerTerms')}
          </Link>
        </nav>
      </div>
    </footer>
  )
}
