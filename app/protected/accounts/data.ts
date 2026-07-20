import 'server-only'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import { type AccountRow, accountRowSchema } from '@/lib/validation/account'

/**
 * Read helpers for accounts (P1-02). All reads go through the RLS-enforced
 * Supabase server client, so a user only ever sees their own rows.
 */

/** Every account for the current user (active + archived), oldest first. */
export async function listAccounts(): Promise<AccountRow[]> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }
  return accountRowSchema.array().parse(data)
}

/** Minimal transaction rows for computing live account balances. */
export interface AccountBalanceTxn {
  account_id: string
  amount_cents: number
  currency: string
}

/**
 * Every transaction (minimal projection) for the current user, so the accounts
 * page can show each account's **live** balance (opening + signed sum) via the
 * P4-01 `accountBalances` core — not just the static opening balance. RLS-scoped.
 */
export async function listTxnsForAccountBalances(): Promise<
  AccountBalanceTxn[]
> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('transactions')
    .select('account_id, amount_cents, currency')

  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []).map((r) => ({
    account_id: String(r.account_id),
    amount_cents: Number(r.amount_cents),
    currency: String(r.currency),
  }))
}

/** The current user's reporting currency, used to default the account form. */
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
