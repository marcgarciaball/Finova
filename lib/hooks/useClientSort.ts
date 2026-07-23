'use client'

import { useMemo, useState } from 'react'
import type { SortDirection } from '@/components/ui/table/SortButton'

export interface ClientSortState<K extends string> {
  dir: SortDirection
  key: K
}

/**
 * In-memory sort for small, fully-loaded row sets (detail-page sub-tables).
 * No URL/server round-trip — these tables aren't paginated, so re-sorting the
 * already-fetched array client-side is enough.
 */
export function useClientSort<T, K extends string>(
  rows: T[],
  comparators: Record<K, (a: T, b: T) => number>
) {
  const [sort, setSort] = useState<ClientSortState<K> | null>(null)

  const sorted = useMemo(() => {
    if (!sort) {
      return rows
    }
    const sortedCopy = [...rows].sort(comparators[sort.key])
    return sort.dir === 'asc' ? sortedCopy : sortedCopy.reverse()
  }, [rows, sort, comparators])

  const toggleSort = (key: K) => {
    setSort((prev) =>
      prev?.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    )
  }

  return { sort, sorted, toggleSort }
}
