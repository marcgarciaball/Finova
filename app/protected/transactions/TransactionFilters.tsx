'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { categoryLabel } from '@/lib/domain/categories/label'
import {
  TRANSACTION_TYPES,
  UNCATEGORIZED,
} from '@/lib/domain/transactions/filters'
import type { AccountRow } from '@/lib/validation/account'
import type { CategoryRow } from '@/lib/validation/category'

const SELECT_CLASS =
  'h-11 w-full rounded-2xl border border-glass-line bg-glass px-3 text-ink text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

/**
 * Filter / search bar. Reads the current filters from the URL and, on change,
 * pushes an updated query string — the server page re-renders with the narrowed
 * list. No client data fetching; the URL is the single source of truth.
 */
export function TransactionFilters({
  accounts,
  categories,
}: {
  accounts: AccountRow[]
  categories: CategoryRow[]
}) {
  const t = useTranslations('transactions')
  const tCat = useTranslations('categories.defaults')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString())
      if (value === '') {
        next.delete(key)
      } else {
        next.set(key, value)
      }
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    },
    [router, pathname, searchParams]
  )

  const get = (key: string) => searchParams.get(key) ?? ''
  const hasAny = Array.from(searchParams.keys()).length > 0

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-glass-line bg-glass p-4 shadow-soft">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-q">{t('filters.search')}</Label>
          <Input
            id="filter-q"
            defaultValue={get('q')}
            placeholder={t('filters.searchPlaceholder')}
            onChange={(e) => setParam('q', e.target.value.trim())}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-account">{t('fields.account')}</Label>
          <select
            id="filter-account"
            className={SELECT_CLASS}
            value={get('account')}
            onChange={(e) => setParam('account', e.target.value)}
          >
            <option value="">{t('filters.allAccounts')}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-category">{t('fields.category')}</Label>
          <select
            id="filter-category"
            className={SELECT_CLASS}
            value={get('category')}
            onChange={(e) => setParam('category', e.target.value)}
          >
            <option value="">{t('filters.allCategories')}</option>
            <option value={UNCATEGORIZED}>{t('uncategorized')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {categoryLabel(c, tCat)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-type">{t('fields.direction')}</Label>
          <select
            id="filter-type"
            className={SELECT_CLASS}
            value={get('type')}
            onChange={(e) => setParam('type', e.target.value)}
          >
            <option value="">{t('filters.allTypes')}</option>
            {TRANSACTION_TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`types.${ty}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-from">{t('filters.from')}</Label>
          <Input
            id="filter-from"
            type="date"
            defaultValue={get('from')}
            onChange={(e) => setParam('from', e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-to">{t('filters.to')}</Label>
          <Input
            id="filter-to"
            type="date"
            defaultValue={get('to')}
            onChange={(e) => setParam('to', e.target.value)}
          />
        </div>
      </div>

      {hasAny ? (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.replace(pathname)}
          >
            {t('filters.clear')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
