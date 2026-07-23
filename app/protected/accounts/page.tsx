import { accountBalances } from '@finova/domain/dashboard'
import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/auth/require-user'
import { AccountList } from './account-list'
import { CreateAccountPanel } from './CreateAccountPanel'
import {
  getBaseCurrency,
  listAccounts,
  listTxnsForAccountBalances,
} from './data'

export default async function AccountsPage() {
  await requireUser()
  const t = await getTranslations('accounts')
  const [accounts, baseCurrency, txns] = await Promise.all([
    listAccounts(),
    getBaseCurrency(),
    listTxnsForAccountBalances(),
  ])

  // Live balance per account = opening + signed sum of its transactions (P4-01).
  const balances = accountBalances(
    accounts.map((a) => ({
      id: a.id,
      currency: a.currency,
      opening_balance: a.opening_balance,
    })),
    txns
  )
  const balanceById = Object.fromEntries(
    balances.map((b) => [b.accountId, b.balance])
  )

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-bold text-2xl">{t('title')}</h1>
      </div>
      <CreateAccountPanel baseCurrency={baseCurrency} />
      <AccountList
        accounts={accounts}
        baseCurrency={baseCurrency}
        balanceById={balanceById}
      />
    </div>
  )
}
