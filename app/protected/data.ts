import 'server-only'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import { type AccountRow, accountRowSchema } from '@/lib/validation/account'
import { type CategoryRow, categoryRowSchema } from '@/lib/validation/category'

/**
 * Dashboard read layer (P4-04). One RLS-enforced fetch of the user's accounts,
 * categories, and a minimal transactions projection — the dashboard slices it
 * per-period in the domain (`filterByPeriod`) and computes every figure from
 * this single dataset. No page cap: totals/balances must be exact, the same
 * rationale as `listTransactionsForTotals`.
 */

/** Minimal transaction shape the dashboard cores need (no note/tags/etc.). */
export interface DashboardTxn {
  account_id: string
  amount_cents: number
  category_id: string | null
  currency: string
  description: string
  id: string
  is_transfer: boolean
  occurred_at: string
}

export interface DashboardData {
  accounts: AccountRow[]
  baseCurrency: string
  categories: CategoryRow[]
  txns: DashboardTxn[]
}

export async function getDashboardData(): Promise<DashboardData> {
  await requireUser()
  const supabase = await createClient()

  const [accountsRes, categoriesRes, txnsRes, profileRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: true }),
    supabase.from('categories').select('*').order('name', { ascending: true }),
    supabase
      .from('transactions')
      .select(
        'id, account_id, category_id, amount_cents, currency, is_transfer, occurred_at, description'
      )
      .order('occurred_at', { ascending: false }),
    supabase.from('profiles').select('base_currency').maybeSingle(),
  ])

  if (accountsRes.error) throw new Error(accountsRes.error.message)
  if (categoriesRes.error) throw new Error(categoriesRes.error.message)
  if (txnsRes.error) throw new Error(txnsRes.error.message)

  const code = profileRes.data?.base_currency
  const baseCurrency =
    typeof code === 'string' && /^[A-Z]{3}$/.test(code) ? code : 'EUR'

  const txns: DashboardTxn[] = (txnsRes.data ?? []).map((r) => ({
    id: String(r.id),
    account_id: String(r.account_id),
    category_id: r.category_id == null ? null : String(r.category_id),
    amount_cents: Number(r.amount_cents),
    currency: String(r.currency),
    is_transfer: Boolean(r.is_transfer),
    occurred_at: String(r.occurred_at),
    description: String(r.description),
  }))

  return {
    accounts: accountRowSchema.array().parse(accountsRes.data),
    categories: categoryRowSchema.array().parse(categoriesRes.data),
    txns,
    baseCurrency,
  }
}
