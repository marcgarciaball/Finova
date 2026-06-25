import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Suspense } from 'react'
import { AuthButton } from '@/components/AuthButton'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'

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
            <div className="flex items-center gap-6">
              <Link href="/" className="font-semibold text-lg">
                {t('app.name')}
              </Link>
              <Link
                href="/protected/accounts"
                className="text-ink-soft text-sm hover:text-ink"
              >
                {t('accounts.nav')}
              </Link>
              <Link
                href="/protected/transactions"
                className="text-ink-soft text-sm hover:text-ink"
              >
                {t('transactions.nav')}
              </Link>
              <Link
                href="/protected/import"
                className="text-ink-soft text-sm hover:text-ink"
              >
                {t('import.nav')}
              </Link>
            </div>
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
