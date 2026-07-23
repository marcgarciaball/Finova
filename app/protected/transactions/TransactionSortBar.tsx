'use client'

import {
  TRANSACTION_SORT_FIELDS,
  type TransactionSort,
  type TransactionSortField,
} from '@finova/domain/transactions/sort'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { SortButton } from '@/components/ui/table/SortButton'

/**
 * Sort toolbar above the transaction list. Same URL-as-source-of-truth
 * pattern as `TransactionFilters` — a click updates `sort`/`dir` in the query
 * string and the server page re-renders with the reordered list.
 */
export function TransactionSortBar({ sort }: { sort: TransactionSort }) {
  const t = useTranslations('transactions')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setSort = (field: TransactionSortField) => {
    const next = new URLSearchParams(searchParams.toString())
    const dir = sort.field === field && sort.dir === 'asc' ? 'desc' : 'asc'
    next.set('sort', field)
    next.set('dir', dir)
    router.replace(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-4 px-1 text-sm">
      <span className="text-ink-soft text-xs">{t('sort.label')}</span>
      {TRANSACTION_SORT_FIELDS.map((field) => (
        <SortButton
          key={field}
          label={t(`sort.${field}`)}
          active={sort.field === field}
          direction={sort.field === field ? sort.dir : 'asc'}
          onClick={() => setSort(field)}
        />
      ))}
    </div>
  )
}
