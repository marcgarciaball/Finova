/**
 * Sort state for the debts table, read from the URL (`sort`/`dir`). The
 * overview is a small, fully-loaded array (no pagination), so unlike
 * transactions this only needs to reorder client-side — no query builder.
 */
export const DEBT_SORT_FIELDS = [
  'lender',
  'type',
  'outstanding',
  'rate',
  'payment',
] as const
export type DebtSortField = (typeof DEBT_SORT_FIELDS)[number]
export type SortDirection = 'asc' | 'desc'

export interface DebtSort {
  dir: SortDirection
  field: DebtSortField
}

const isField = (v: string | undefined): v is DebtSortField =>
  v != null && (DEBT_SORT_FIELDS as readonly string[]).includes(v)

/** Parses to `null` (keep the server's default order) when absent/malformed. */
export function parseDebtsSort(params: {
  sort?: string
  dir?: string
}): DebtSort | null {
  if (!isField(params.sort)) {
    return null
  }
  return { field: params.sort, dir: params.dir === 'desc' ? 'desc' : 'asc' }
}
