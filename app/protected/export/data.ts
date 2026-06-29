import 'server-only'
import { requireUser } from '@/lib/auth/require-user'
import type { ExportInput } from '@/lib/domain/export/bundle'
import { createClient } from '@/lib/supabase/server'
import { accountRowSchema } from '@/lib/validation/account'
import { categoryRowSchema } from '@/lib/validation/category'
import { transactionRowSchema } from '@/lib/validation/transaction'

/**
 * Export read layer (P4-05). RLS-enforced full read of the user's data — every
 * query goes through the Supabase server client, so a user only ever exports
 * their own rows. Transactions are ordered oldest-first so the exported ledger
 * reads chronologically.
 */
export async function getExportData(): Promise<ExportInput> {
  await requireUser()
  const supabase = await createClient()

  const [accountsRes, categoriesRes, txnsRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: true }),
    supabase.from('categories').select('*').order('name', { ascending: true }),
    supabase
      .from('transactions')
      .select('*')
      .order('occurred_at', { ascending: true }),
  ])

  if (accountsRes.error) throw new Error(accountsRes.error.message)
  if (categoriesRes.error) throw new Error(categoriesRes.error.message)
  if (txnsRes.error) throw new Error(txnsRes.error.message)

  return {
    accounts: accountRowSchema.array().parse(accountsRes.data),
    categories: categoryRowSchema.array().parse(categoriesRes.data),
    transactions: transactionRowSchema.array().parse(txnsRes.data),
  }
}
