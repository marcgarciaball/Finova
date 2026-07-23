'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { SortButton } from '@/components/ui/table/SortButton'
import {
  PROPERTY_SORT_FIELDS,
  type PropertySort,
  type PropertySortField,
} from './sort'

const LABEL_KEY: Record<PropertySortField, string> = {
  name: 'sort.name',
  value: 'card.value',
  equity: 'card.equity',
}

export function RealEstateSortBar({ sort }: { sort: PropertySort | null }) {
  const t = useTranslations('realEstate')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setSort = (field: PropertySortField) => {
    const next = new URLSearchParams(searchParams.toString())
    const dir = sort?.field === field && sort.dir === 'asc' ? 'desc' : 'asc'
    next.set('sort', field)
    next.set('dir', dir)
    router.replace(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <span className="text-ink-soft text-xs">{t('sort.label')}</span>
      {PROPERTY_SORT_FIELDS.map((field) => (
        <SortButton
          key={field}
          label={t(LABEL_KEY[field])}
          active={sort?.field === field}
          direction={sort?.field === field ? sort.dir : 'asc'}
          onClick={() => setSort(field)}
        />
      ))}
    </div>
  )
}
