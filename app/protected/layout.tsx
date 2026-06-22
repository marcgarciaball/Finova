import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Suspense } from 'react'
import { AuthButton } from '@/components/auth-button'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { ThemeSwitcher } from '@/components/theme-switcher'

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = useTranslations()

  return (
    <main className="flex min-h-screen flex-col items-center">
      <div className="flex w-full flex-1 flex-col items-center gap-20">
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
        <div className="flex w-full max-w-5xl flex-1 flex-col gap-20 p-5">
          {children}
        </div>
      </div>
    </main>
  )
}
