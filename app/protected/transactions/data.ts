import 'server-only'
import { applyFilters } from '@finova/domain/transactions/apply-filters'
import type { TransactionFilters } from '@finova/domain/transactions/filters'
import { pageRange } from '@finova/domain/transactions/pagination'
import { requireUser } from '@/lib/auth/require-user'
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

/** One page of transactions plus the total matching count (for the UI). */
export interface TransactionPage {
  rows: TransactionRow[]
  total: number
}

/**
 * One page of the current user's transactions, filtered, newest first. Uses a
 * PostgREST `.range()` + `count: 'exact'` so only `PAGE_SIZE` rows are fetched
 * and rendered even for a multi-year ledger, while the UI still knows the total
 * page count. `page` is 1-based; an out-of-range page yields an empty `rows`.
 */
export async function listTransactions(
  filters: TransactionFilters,
  page = 1
): Promise<TransactionPage> {
  await requireUser()
  const supabase = await createClient()

  const { from, to } = pageRange(page)
  const query = applyFilters(
    supabase.from('transactions').select('*', { count: 'exact' }),
    filters
  )
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to)

  const { data, error, count } = await query
  if (error) {
    throw new Error(error.message)
  }
  return {
    rows: transactionRowSchema.array().parse(data),
    total: count ?? 0,
  }
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
