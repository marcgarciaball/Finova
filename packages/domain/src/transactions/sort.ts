/**
 * Transaction list sort parsing & normalization, mirroring `filters.ts`: the
 * sort column/direction lives in the URL (`sort`/`dir`) so it's shareable and
 * survives a reload, and this module is the single pure source of truth for
 * parsing it and serializing it back.
 */

import type { RawParams } from './filters'

export const TRANSACTION_SORT_FIELDS = [
  'date',
  'description',
  'amount',
] as const
export type TransactionSortField = (typeof TRANSACTION_SORT_FIELDS)[number]

export type SortDirection = 'asc' | 'desc'

export interface TransactionSort {
  dir: SortDirection
  field: TransactionSortField
}

export const DEFAULT_TRANSACTION_SORT: TransactionSort = {
  field: 'date',
  dir: 'desc',
}

const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v

const isField = (v: string | undefined): v is TransactionSortField =>
  v != null && (TRANSACTION_SORT_FIELDS as readonly string[]).includes(v)

const isDirection = (v: string | undefined): v is SortDirection =>
  v === 'asc' || v === 'desc'

/** Parse `sort`/`dir` from a raw search-params bag, falling back to the default. */
export function parseTransactionSort(params: RawParams): TransactionSort {
  const field = first(params.sort)
  const dir = first(params.dir)
  return {
    field: isField(field) ? field : DEFAULT_TRANSACTION_SORT.field,
    dir: isDirection(dir) ? dir : DEFAULT_TRANSACTION_SORT.dir,
  }
}

/** The `(column, ascending)` pair a query builder's `.order()` call needs. */
export function transactionSortColumn(sort: TransactionSort): {
  column: string
  ascending: boolean
} {
  const columnByField: Record<TransactionSortField, string> = {
    date: 'occurred_at',
    description: 'description',
    amount: 'amount_cents',
  }
  return { column: columnByField[sort.field], ascending: sort.dir === 'asc' }
}
