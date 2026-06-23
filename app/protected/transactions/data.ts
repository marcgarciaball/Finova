import 'server-only'
import { requireUser } from '@/lib/auth/require-user'
import {
  type TransactionFilters,
  UNCATEGORIZED,
} from '@/lib/domain/transactions/filters'
import { createClient } from '@/lib/supabase/server'
import { type AccountRow, accountRowSchema } from '@/lib/validation/account'
import { type CategoryRow, categoryRowSchema } from '@/lib/validation/category'
import {
  type TransactionRow,
  transactionRowSchema,
} from '@/lib/validation/transaction'

/**
 * Read helpers for transactions (P1-05). All reads go through the RLS-enforced
 * Supabase server client, so a user only ever sees their own rows. The list
 * query applies the URL-derived filters server-side and orders newest first
 * (matching the `(user_id, occurred_at desc)` index).
 */

const PAGE_SIZE = 200

/**
 * Apply the URL-derived filters to a PostgREST query. Shared by the list and
 * the totals query so both always agree on what "matching" means. The builder
 * is loosely typed: PostgREST's self-referential chain type overflows a precise
 * generic here, and the result is zod-validated downstream regardless.
 */
// biome-ignore lint/suspicious/noExplicitAny: PostgREST builder chain type is self-referential
function applyFilters<Q extends Record<string, any>>(
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

/** The current user's transactions, filtered, newest first (capped). */
export async function listTransactions(
  filters: TransactionFilters
): Promise<TransactionRow[]> {
  await requireUser()
  const supabase = await createClient()

  const query = applyFilters(supabase.from('transactions').select('*'), filters)
    .order('occurred_at', { ascending: false })
    .limit(PAGE_SIZE)

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }
  return transactionRowSchema.array().parse(data)
}

/** Minimal row shape for totals — only what {@link summarizeByCurrency} needs. */
export interface TotalsRow {
  amount_cents: number
  currency: string
  is_transfer: boolean
}

/**
 * Lightweight totals feed: every matching row (no page cap), three columns
 * only, so the summary is accurate even when the list itself is truncated to
 * {@link PAGE_SIZE}.
 */
export async function listTransactionsForTotals(
  filters: TransactionFilters
): Promise<TotalsRow[]> {
  await requireUser()
  const supabase = await createClient()

  const query = applyFilters(
    supabase.from('transactions').select('amount_cents, currency, is_transfer'),
    filters
  )

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []).map((r) => ({
    amount_cents: Number(r.amount_cents),
    currency: String(r.currency),
    is_transfer: Boolean(r.is_transfer),
  }))
}

/** Active accounts for the form's account picker, oldest first. */
export async function listAccountsForPicker(): Promise<AccountRow[]> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('archived', false)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }
  return accountRowSchema.array().parse(data)
}

/** All categories for the category picker / recategorize control. */
export async function listCategoriesForPicker(): Promise<CategoryRow[]> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }
  return categoryRowSchema.array().parse(data)
}

/** The current user's reporting currency, used to default the transaction form. */
export async function getBaseCurrency(): Promise<string> {
  await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('base_currency')
    .maybeSingle()

  const code = data?.base_currency
  return typeof code === 'string' && /^[A-Z]{3}$/.test(code) ? code : 'EUR'
}
