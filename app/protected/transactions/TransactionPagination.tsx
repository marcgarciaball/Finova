'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import {
  filtersToSearchParams,
  type TransactionFilters,
} from '@/lib/domain/transactions/filters'

/**
 * Prev / Next pager for the transactions list (P5-06). Server-rendered links
 * that preserve the active filters and only change `?page=`, so pagination
 * stays shareable and needs no client fetch.
 */
export function TransactionPagination({
  page,
  totalPages,
  filters,
}: {
  page: number
  totalPages: number
  filters: TransactionFilters
}) {
  const t = useTranslations('transactions.pagination')

  if (totalPages <= 1) {
    return null
  }

  const href = (target: number): string => {
    const params = filtersToSearchParams(filters)
    if (target > 1) {
      params.set('page', String(target))
    }
    const qs = params.toString()
    return qs ? `?${qs}` : '?'
  }

  const hasPrev = page > 1
  const hasNext = page < totalPages

  return (
    <nav
      aria-label={t('label')}
      className="flex items-center justify-between gap-3"
    >
      <Button
        asChild={hasPrev}
        variant="ghost"
        size="sm"
        disabled={!hasPrev}
        aria-disabled={!hasPrev}
      >
        {hasPrev ? (
          <Link href={href(page - 1)} rel="prev">
            <ChevronLeft aria-hidden="true" />
            {t('previous')}
          </Link>
        ) : (
          <span>
            <ChevronLeft aria-hidden="true" />
            {t('previous')}
          </span>
        )}
      </Button>

      <span className="text-ink-soft text-sm tabular-nums">
        {t('pageOf', { page, total: totalPages })}
      </span>

      <Button
        asChild={hasNext}
        variant="ghost"
        size="sm"
        disabled={!hasNext}
        aria-disabled={!hasNext}
      >
        {hasNext ? (
          <Link href={href(page + 1)} rel="next">
            {t('next')}
            <ChevronRight aria-hidden="true" />
          </Link>
        ) : (
          <span>
            {t('next')}
            <ChevronRight aria-hidden="true" />
          </span>
        )}
      </Button>
    </nav>
  )
}
