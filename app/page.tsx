import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Suspense } from 'react'
import { AuthButton } from '@/components/auth-button'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { Button } from '@/components/ui/button'

export default function Home() {
  const t = useTranslations()

  return (
    <main className="flex min-h-screen flex-col items-center">
      <div className="flex w-full flex-1 flex-col items-center">
        <nav className="flex h-16 w-full justify-center border-b border-b-foreground/10">
          <div className="flex w-full max-w-5xl items-center justify-between p-3 px-5 text-sm">
            <Link href="/" className="font-semibold text-lg">
              {t('app.name')}
            </Link>
            <div className="flex items-center gap-2">
              <LocaleSwitcher />
              <ThemeSwitcher />
              <Suspense>
                <AuthButton />
              </Suspense>
            </div>
          </div>
        </nav>

        <section className="flex max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-5 py-20 text-center">
          <h1 className="text-balance font-bold text-4xl sm:text-5xl">
            {t('landing.title')}
          </h1>
          <p className="max-w-2xl text-balance text-lg text-muted-foreground">
            {t('landing.subtitle')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/auth/sign-up">{t('landing.ctaPrimary')}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/auth/login">{t('landing.ctaSecondary')}</Link>
            </Button>
          </div>
        </section>

        <footer className="w-full border-t py-8 text-center">
          <p className="text-muted-foreground text-xs">
            {t('landing.disclaimer')}
          </p>
        </footer>
      </div>
    </main>
  )
}
