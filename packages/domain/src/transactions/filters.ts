/**
 * Transaction filter parsing & normalization (P1-05).
 *
 * The transactions page encodes its filter state in the URL query string so it
 * is shareable and back-button friendly. This module is the single, pure source
 * of truth for turning a raw `searchParams` bag into a typed, validated
 * `TransactionFilters`, and back into a query string. No I/O, no React — just
 * data, so it is cheap to unit-test.
 */

export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

/** Sentinel category value meaning "rows with no category". */
export const UNCATEGORIZED = 'none'

export interface TransactionFilters {
  /** Account id to restrict to, or null for all accounts. */
  accountId: string | null
  /** Category id, the `UNCATEGORIZED` sentinel, or null for all categories. */
  categoryId: string | null
  /** Inclusive lower bound on `occurred_at` (YYYY-MM-DD), or null. */
  from: string | null
  /** Free-text description search (trimmed, non-empty), or null. */
  q: string | null
  /** Inclusive upper bound on `occurred_at` (YYYY-MM-DD), or null. */
  to: string | null
  /** Direction/transfer filter, or null for all. */
  type: TransactionType | null
}

export const EMPTY_FILTERS: TransactionFilters = {
  accountId: null,
  categoryId: null,
  type: null,
  from: null,
  to: null,
  q: null,
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** A `searchParams`-shaped bag: a value may be absent, a string, or repeated. */
export type RawParams = Record<string, string | string[] | undefined>

const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v

const cleanId = (v: string | undefined): string | null =>
  v && UUID_RE.test(v) ? v : null

const cleanDate = (v: string | undefined): string | null =>
  v && DATE_RE.test(v) ? v : null

const isType = (v: string | undefined): v is TransactionType =>
  v != null && (TRANSACTION_TYPES as readonly string[]).includes(v)

/**
 * Parse a raw search-params bag into validated filters. Anything malformed is
 * silently dropped to null — a bad URL yields an unfiltered list, never a throw.
 */
export function parseFilters(params: RawParams): TransactionFilters {
  const category = first(params.category)
  const q = first(params.q)?.trim()
  return {
    accountId: cleanId(first(params.account)),
    categoryId: category === UNCATEGORIZED ? UNCATEGORIZED : cleanId(category),
    type: isType(first(params.type))
      ? (first(params.type) as TransactionType)
      : null,
    from: cleanDate(first(params.from)),
    to: cleanDate(first(params.to)),
    q: q ? q : null,
  }
}

/** Serialize filters back to a `URLSearchParams` (omitting null fields). */
export function filtersToSearchParams(
  filters: TransactionFilters
): URLSearchParams {
  const sp = new URLSearchParams()
  if (filters.accountId) sp.set('account', filters.accountId)
  if (filters.categoryId) sp.set('category', filters.categoryId)
  if (filters.type) sp.set('type', filters.type)
  if (filters.from) sp.set('from', filters.from)
  if (filters.to) sp.set('to', filters.to)
  if (filters.q) sp.set('q', filters.q)
  return sp
}

/** True when no filter is active (the default, full list). */
export function hasActiveFilters(filters: TransactionFilters): boolean {
  return (
    filters.accountId !== null ||
    filters.categoryId !== null ||
    filters.type !== null ||
    filters.from !== null ||
    filters.to !== null ||
    filters.q !== null
  )
}

/** Classify a transaction row's direction for display / filtering. */
export function transactionType(row: {
  amount_cents: number
  is_transfer: boolean
}): TransactionType {
  if (row.is_transfer) return 'transfer'
  return row.amount_cents >= 0 ? 'income' : 'expense'
}
