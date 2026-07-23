'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { SortButton } from '@/components/ui/table/SortButton'
import {
  MANUAL_ASSET_SORT_FIELDS,
  type ManualAssetSort,
  type ManualAssetSortField,
} from './sort'

const LABEL_KEY: Record<ManualAssetSortField, string> = {
  name: 'sort.name',
  value: 'card.value',
  gainLoss: 'card.gainLoss',
}

export function ManualAssetsSortBar({
  sort,
}: {
  sort: ManualAssetSort | null
}) {
  const t = useTranslations('manualAssets')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setSort = (field: ManualAssetSortField) => {
    const next = new URLSearchParams(searchParams.toString())
    const dir = sort?.field === field && sort.dir === 'asc' ? 'desc' : 'asc'
    next.set('sort', field)
    next.set('dir', dir)
    router.replace(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <span className="text-ink-soft text-xs">{t('sort.label')}</span>
      {MANUAL_ASSET_SORT_FIELDS.map((field) => (
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
