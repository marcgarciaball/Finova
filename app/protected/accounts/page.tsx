import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/auth/require-user'
import { AccountList } from './account-list'
import { CreateAccountPanel } from './CreateAccountPanel'
import { getBaseCurrency, listAccounts } from './data'

export default async function AccountsPage() {
  await requireUser()
  const t = await getTranslations('accounts')
  const [accounts, baseCurrency] = await Promise.all([
    listAccounts(),
    getBaseCurrency(),
  ])

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-bold text-2xl">{t('title')}</h1>
      </div>
      <CreateAccountPanel baseCurrency={baseCurrency} />
      <AccountList accounts={accounts} baseCurrency={baseCurrency} />
    </div>
  )
}
