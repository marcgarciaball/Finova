/**
 * Sort state for the assets grid, read from the URL (`sort`/`dir`). The
 * overview is a small, fully-loaded array (no pagination), so unlike
 * transactions this only needs to reorder client-side — no query builder.
 */
export const MANUAL_ASSET_SORT_FIELDS = ['name', 'value', 'gainLoss'] as const
export type ManualAssetSortField = (typeof MANUAL_ASSET_SORT_FIELDS)[number]
export type SortDirection = 'asc' | 'desc'

export interface ManualAssetSort {
  dir: SortDirection
  field: ManualAssetSortField
}

const isField = (v: string | undefined): v is ManualAssetSortField =>
  v != null && (MANUAL_ASSET_SORT_FIELDS as readonly string[]).includes(v)

/** Parses to `null` (keep the server's default order) when absent/malformed. */
export function parseManualAssetsSort(params: {
  sort?: string
  dir?: string
}): ManualAssetSort | null {
  if (!isField(params.sort)) {
    return null
  }
  return { field: params.sort, dir: params.dir === 'desc' ? 'desc' : 'asc' }
}
