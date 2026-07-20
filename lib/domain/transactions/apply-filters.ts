import {
  type TransactionFilters,
  UNCATEGORIZED,
} from '@/lib/domain/transactions/filters'

/**
 * Apply the URL-derived filters to a PostgREST query. Shared by the
 * transactions list, its totals query, and the export read layer so all
 * callers always agree on what "matching" means. The builder is loosely
 * typed: PostgREST's self-referential chain type overflows a precise generic
 * here, and the result is zod-validated downstream regardless.
 */
// biome-ignore lint/suspicious/noExplicitAny: PostgREST builder chain type is self-referential
export function applyFilters<Q extends Record<string, any>>(
  query: Q,
  filters: TransactionFilters
): Q {
  let q = query
  if (filters.accountId) {
    q = q.eq('account_id', filters.accountId)
  }
  if (filters.categoryId === UNCATEGORIZED) {
    q = q.is('category_id', null)
  } else if (filters.categoryId) {
    q = q.eq('category_id', filters.categoryId)
  }
  switch (filters.type) {
    case 'income':
      q = q.eq('is_transfer', false).gte('amount_cents', 0)
      break
    case 'expense':
      q = q.eq('is_transfer', false).lt('amount_cents', 0)
      break
    case 'transfer':
      q = q.eq('is_transfer', true)
      break
    default:
      break
  }
  if (filters.from) {
    q = q.gte('occurred_at', `${filters.from}T00:00:00Z`)
  }
  if (filters.to) {
    // Inclusive upper bound: anything on the `to` day, up to end of day UTC.
    q = q.lte('occurred_at', `${filters.to}T23:59:59.999Z`)
  }
  if (filters.q) {
    // Escape PostgREST `ilike` wildcards in user input before wrapping.
    const term = filters.q.replace(/[%_]/g, (m) => `\\${m}`)
    q = q.ilike('description', `%${term}%`)
  }
  return q
}
