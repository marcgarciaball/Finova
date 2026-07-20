import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/auth/require-user'
import {
  hasActiveFilters,
  parseFilters,
  type RawParams,
} from '@/lib/domain/transactions/filters'
import { parsePage, totalPages } from '@/lib/domain/transactions/pagination'
import { CreateTransactionPanel } from './CreateTransactionPanel'
import {
  getBaseCurrency,
  listAccountsForPicker,
  listCategoriesForPicker,
  listTransactions,
  listTransactionsForTotals,
} from './data'
import { RecategorizeButton } from './RecategorizeButton'
import { TransactionFilters } from './TransactionFilters'
import { TransactionPagination } from './TransactionPagination'
import { TransactionsSummary } from './TransactionsSummary'
import { TransactionList } from './transaction-list'

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>
}) {
  await requireUser()
  const t = await getTranslations('transactions')
  const raw = await searchParams
  const filters = parseFilters(raw)
  const page = parsePage(raw.page)

  const [txnPage, totalsRows, accounts, categories, baseCurrency] =
    await Promise.all([
      listTransactions(filters, page),
      listTransactionsForTotals(filters),
      listAccountsForPicker(),
      listCategoriesForPicker(),
      getBaseCurrency(),
    ])

  const todayIso = new Date().toISOString().slice(0, 10)
  const pageCount = totalPages(txnPage.total)

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-bold text-2xl">{t('title')}</h1>
        <RecategorizeButton />
      </div>
      <CreateTransactionPanel
        accounts={accounts}
        categories={categories}
        baseCurrency={baseCurrency}
        todayIso={todayIso}
      />
      <TransactionFilters accounts={accounts} categories={categories} />
      <TransactionsSummary transactions={totalsRows} />
      <TransactionList
        transactions={txnPage.rows}
        accounts={accounts}
        categories={categories}
        baseCurrency={baseCurrency}
        todayIso={todayIso}
        filtered={hasActiveFilters(filters)}
      />
      <TransactionPagination
        page={page}
        totalPages={pageCount}
        filters={filters}
      />
    </div>
  )
}
