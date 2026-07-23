/**
 * Sort state for the properties grid, read from the URL (`sort`/`dir`). The
 * overview is a small, fully-loaded array (no pagination), so unlike
 * transactions this only needs to reorder client-side — no query builder.
 */
export const PROPERTY_SORT_FIELDS = ['name', 'value', 'equity'] as const
export type PropertySortField = (typeof PROPERTY_SORT_FIELDS)[number]
export type SortDirection = 'asc' | 'desc'

export interface PropertySort {
  dir: SortDirection
  field: PropertySortField
}

const isField = (v: string | undefined): v is PropertySortField =>
  v != null && (PROPERTY_SORT_FIELDS as readonly string[]).includes(v)

/** Parses to `null` (keep the server's default order) when absent/malformed. */
export function parsePropertySort(params: {
  sort?: string
  dir?: string
}): PropertySort | null {
  if (!isField(params.sort)) {
    return null
  }
  return { field: params.sort, dir: params.dir === 'desc' ? 'desc' : 'asc' }
}
