'use client'

import type { TransactionFilters } from '@finova/domain/transactions/filters'
import { hasMore } from '@finova/domain/transactions/pagination'
import type { TransactionSort } from '@finova/domain/transactions/sort'
import { useTranslations } from 'next-intl'
import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import type { AccountRow } from '@/lib/validation/account'
import type { CategoryRow } from '@/lib/validation/category'
import type { TransactionRow } from '@/lib/validation/transaction'
import { loadMoreTransactions } from './actions'
import { BulkDeleteBar } from './BulkDeleteBar'
import { SelectionProvider } from './SelectionContext'
import { SelectionHeader } from './SelectionHeader'
import { TransactionRow as Row } from './TransactionRow'
import { TransactionSortBar } from './TransactionSortBar'

/**
 * Client list of transaction rows, newest first, with a "Load more" button
 * that fetches and appends the next batch in place (no page navigation, no
 * scroll jump). Resets to the server-provided first batch whenever `page.tsx`
 * re-renders with fresh data (filter change, or a create/edit/delete
 * elsewhere revalidating the page).
 */
export function TransactionList({
  transactions,
  total,
  filters,
  sort,
  accounts,
  categories,
  baseCurrency,
  todayIso,
  filtered,
}: {
  transactions: TransactionRow[]
  total: number
  filters: TransactionFilters
  sort: TransactionSort
  accounts: AccountRow[]
  categories: CategoryRow[]
  baseCurrency: string
  todayIso: string
  filtered: boolean
}) {
  const t = useTranslations('transactions')
  const [rows, setRows] = useState(transactions)
  const [rowsTotal, setRowsTotal] = useState(total)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setRows(transactions)
    setRowsTotal(total)
  }, [transactions, total])

  if (rows.length === 0) {
    return (
      <p className="text-ink-soft text-sm">
        {filtered ? t('emptyFiltered') : t('empty')}
      </p>
    )
  }

  const loadMore = () => {
    startTransition(async () => {
      const next = await loadMoreTransactions(filters, rows.length, sort)
      setRows((prev) => [...prev, ...next.rows])
      setRowsTotal(next.total)
    })
  }

  const pageIds = rows.map((transaction) => transaction.id)

  return (
    <SelectionProvider
      key={JSON.stringify(filters)}
      pageIds={pageIds}
      totalFiltered={rowsTotal}
      filters={filters}
    >
      <div className="flex flex-col gap-3">
        <TransactionSortBar sort={sort} />
        <SelectionHeader />
        {rows.map((transaction) => (
          <Row
            key={transaction.id}
            transaction={transaction}
            accounts={accounts}
            categories={categories}
            baseCurrency={baseCurrency}
            todayIso={todayIso}
          />
        ))}
        {hasMore(rowsTotal, rows.length) && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadMore}
              disabled={isPending}
            >
              {t('pagination.loadMore')}
            </Button>
          </div>
        )}
      </div>
      <BulkDeleteBar />
    </SelectionProvider>
  )
}
