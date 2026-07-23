import type { BalanceAccount, BalanceTxn } from '@finova/domain'
import { supabase } from '../lib/supabase'

export interface MobileDashboardData {
  accounts: BalanceAccount[]
  txns: BalanceTxn[]
}

export async function getDashboardData(): Promise<MobileDashboardData> {
  const [accountsRes, txnsRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, currency, opening_balance')
      .eq('archived', false),
    supabase.from('transactions').select('account_id, amount_cents, currency'),
  ])
  if (accountsRes.error) {
    throw new Error(accountsRes.error.message)
  }
  if (txnsRes.error) {
    throw new Error(txnsRes.error.message)
  }
  return {
    accounts: accountsRes.data ?? [],
    txns: txnsRes.data ?? [],
  }
}
