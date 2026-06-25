import { getTranslations } from 'next-intl/server'
import type { AccountRow } from '@/lib/validation/account'
import type { CategoryRow } from '@/lib/validation/category'
import type { TransactionRow } from '@/lib/validation/transaction'
import { TransactionRow as Row } from './TransactionRow'

/**
 * Presentational (server) list of transaction rows, newest first. Empty-state
 * polish is deferred to P4-06; this shows a plain message.
 */
export async function TransactionList({
  transactions,
  accounts,
  categories,
  baseCurrency,
  todayIso,
  filtered,
}: {
  transactions: TransactionRow[]
  accounts: AccountRow[]
  categories: CategoryRow[]
  baseCurrency: string
  todayIso: string
  filtered: boolean
}) {
  const t = await getTranslations('transactions')

  if (transactions.length === 0) {
    return (
      <p className="text-ink-soft text-sm">
        {filtered ? t('emptyFiltered') : t('empty')}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {transactions.map((transaction) => (
        <Row
          key={transaction.id}
          transaction={transaction}
          accounts={accounts}
          categories={categories}
          baseCurrency={baseCurrency}
          todayIso={todayIso}
        />
      ))}
    </div>
  )
}
