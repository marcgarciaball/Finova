import 'server-only'
import {
  accountFingerprint,
  categoryFingerprint,
  transactionFingerprint,
} from '@finova/domain/import/backup/transactions-fingerprint'
import type { ExistingTransactions } from '@finova/domain/import/backup/transactions-plan'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'

/**
 * Snapshot of the user's current transactions fingerprints (Spec D). RLS server
 * client. Accounts/categories fingerprint from content; the transaction
 * fingerprint reuses the CSV importer's scheme (keyed on the real account id +
 * content) so a JSON restore dedupes against CSV-imported and manual rows alike.
 */
export async function getTransactionsFingerprints(): Promise<ExistingTransactions> {
  await requireUser()
  const supabase = await createClient()

  const [accounts, categories, txns] = await Promise.all([
    supabase.from('accounts').select('id, name, type, currency'),
    supabase.from('categories').select('id, parent_id, name, kind'),
    supabase
      .from('transactions')
      .select('account_id, amount_cents, description, occurred_at'),
  ])
  for (const res of [accounts, categories, txns]) {
    if (res.error) throw new Error(res.error.message)
  }

  const accountIdByFp = new Map<string, string>()
  for (const a of accounts.data ?? []) {
    accountIdByFp.set(
      accountFingerprint({
        name: String(a.name),
        type: String(a.type),
        currency: String(a.currency),
      }),
      String(a.id)
    )
  }

  const categoryById = new Map<string, { name: string; kind: string }>()
  for (const c of categories.data ?? []) {
    categoryById.set(String(c.id), {
      name: String(c.name),
      kind: String(c.kind),
    })
  }
  const categoryIdByFp = new Map<string, string>()
  for (const c of categories.data ?? []) {
    let parentFp = ''
    if (c.parent_id) {
      const parent = categoryById.get(String(c.parent_id))
      if (parent) parentFp = categoryFingerprint(parent.kind, parent.name, '')
    }
    categoryIdByFp.set(
      categoryFingerprint(String(c.kind), String(c.name), parentFp),
      String(c.id)
    )
  }

  const txnFps = new Set<string>()
  for (const t of txns.data ?? []) {
    txnFps.add(
      transactionFingerprint({
        accountId: String(t.account_id),
        amountCents: Number(t.amount_cents),
        description: String(t.description),
        occurredAt: String(t.occurred_at),
      })
    )
  }

  return { accountIdByFp, categoryIdByFp, txnFps }
}
