import { Plus } from 'lucide-react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import {
  getBaseCurrency,
  listAccountsForPicker,
  listCategoriesForPicker,
} from '@/app/protected/transactions/data'
import { AvatarMenu } from '@/components/nav/AvatarMenu'
import { QuickAddTransaction } from '@/components/transactions/QuickAddTransaction'
import { Button } from '@/components/ui/Button'
import { requireUser } from '@/lib/auth/require-user'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getTranslations()
  const claims = await requireUser()
  const [accounts, categories, baseCurrency] = await Promise.all([
    listAccountsForPicker(),
    listCategoriesForPicker(),
    getBaseCurrency(),
  ])
  const todayIso = new Date().toISOString().slice(0, 10)
  const email = typeof claims.email === 'string' ? claims.email : ''

  const navLinks = [
    { href: '/protected', label: t('dashboard.nav') },
    { href: '/protected/transactions', label: t('transactions.nav') },
    { href: '/protected/expenses', label: t('expenses.nav') },
    { href: '/protected/accounts', label: t('accounts.nav') },
    { href: '/protected/investments', label: t('investments.nav') },
    { href: '/protected/real-estate', label: t('realEstate.nav') },
  ]

  return (
    <main className="flex min-h-screen flex-col items-center">
      <div className="flex w-full flex-1 flex-col items-center gap-20">
        <nav className="flex h-16 w-full justify-center border-b border-b-foreground/10">
          <div className="flex w-full max-w-5xl items-center justify-between p-3 px-5 text-sm">
            <div className="flex items-center gap-6">
              <Link href="/protected" className="font-semibold text-lg">
                {t('app.name')}
              </Link>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-ink-soft text-sm hover:text-ink"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <QuickAddTransaction
                accounts={accounts}
                categories={categories}
                baseCurrency={baseCurrency}
                todayIso={todayIso}
                trigger={
                  <Button
                    type="button"
                    size="sm"
                    className="hidden sm:inline-flex"
                  >
                    <Plus aria-hidden="true" />
                    {t('transactions.new')}
                  </Button>
                }
              />
              <AvatarMenu email={email} />
            </div>
          </div>
        </nav>
        <div className="flex w-full max-w-5xl flex-1 flex-col gap-20 p-5">
          {children}
        </div>
        <QuickAddTransaction
          accounts={accounts}
          categories={categories}
          baseCurrency={baseCurrency}
          todayIso={todayIso}
          trigger={
            <Button
              type="button"
              size="icon"
              aria-label={t('transactions.new')}
              className="fixed right-6 bottom-6 z-40 size-14 rounded-full shadow-soft sm:hidden"
            >
              <Plus aria-hidden="true" />
            </Button>
          }
        />
      </div>
    </main>
  )
}
