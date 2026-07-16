'use server'

import { randomUUID } from 'node:crypto'
import { requireUser } from '@/lib/auth/require-user'
import { parseBackup } from '@/lib/domain/import/backup/parse'
import { transactionFingerprint } from '@/lib/domain/import/backup/transactions-fingerprint'
import {
  planTransactionsImport,
  type TransactionsImportPlan,
  type TransactionsTable,
} from '@/lib/domain/import/backup/transactions-plan'
import { createClient } from '@/lib/supabase/server'
import { getTransactionsFingerprints } from './data'

/**
 * Transactions round-trip import (Spec D). Restores the transactions domain
 * (accounts, the two-level category tree, transactions) from a Finova JSON.
 * Ownership from the JWT; ids regenerated with FK remap. Category parents insert
 * before children; transfer group ids are remapped to fresh UUIDs so the two
 * legs stay linked. Transaction fingerprints match the CSV importer, so re-import
 * (and cross-channel dedup) is a no-op via `ON CONFLICT`.
 */

export interface TableCounts {
  duplicate: number
  error: number
  new: number
}

export type TransactionsReviewResult =
  | {
      ok: true
      counts: Record<TransactionsTable, TableCounts>
      totals: TableCounts
    }
  | { ok: false; error: string }

export type TransactionsCommitResult =
  | {
      ok: true
      counts: Record<TransactionsTable, TableCounts>
      committed: number
      skipped: number
      errors: number
    }
  | { ok: false; error: string }

function sumCounts(
  counts: Record<TransactionsTable, TableCounts>
): TableCounts {
  return Object.values(counts).reduce(
    (acc, c) => ({
      new: acc.new + c.new,
      duplicate: acc.duplicate + c.duplicate,
      error: acc.error + c.error,
    }),
    { new: 0, duplicate: 0, error: 0 }
  )
}

async function planFromFile(
  fileText: string
): Promise<
  { ok: true; plan: TransactionsImportPlan } | { ok: false; error: string }
> {
  let raw: unknown
  try {
    raw = JSON.parse(fileText)
  } catch {
    return { ok: false, error: 'malformed' }
  }
  const parsed = parseBackup(raw)
  if (!parsed.ok) return { ok: false, error: parsed.error.code }
  if (!parsed.data.transactions) return { ok: false, error: 'noTransactions' }

  const existing = await getTransactionsFingerprints()
  const plan = planTransactionsImport(parsed.data.transactions, existing)
  return { ok: true, plan }
}

export async function reviewTransactionsBackup(input: {
  fileText: string
}): Promise<TransactionsReviewResult> {
  await requireUser()
  try {
    const result = await planFromFile(input.fileText)
    if (!result.ok) return { ok: false, error: result.error }
    return {
      ok: true,
      counts: result.plan.counts,
      totals: sumCounts(result.plan.counts),
    }
  } catch {
    return { ok: false, error: 'unexpected' }
  }
}

export async function commitTransactionsBackup(input: {
  fileText: string
}): Promise<TransactionsCommitResult> {
  const claims = await requireUser()
  const userId = claims.sub
  try {
    const result = await planFromFile(input.fileText)
    if (!result.ok) return { ok: false, error: result.error }
    const { plan } = result
    const supabase = await createClient()

    // 1. Accounts.
    const accountFpToId = new Map<string, string>()
    for (const a of plan.accounts) {
      if (a.status === 'duplicate' && a.existingId) {
        accountFpToId.set(a.fp, a.existingId)
      }
    }
    const newAccounts = plan.accounts.filter((a) => a.status === 'new')
    if (newAccounts.length > 0) {
      const { data, error } = await supabase
        .from('accounts')
        .insert(
          newAccounts.map((a) => ({
            user_id: userId,
            name: a.row.name,
            type: a.row.type,
            currency: a.row.currency,
            opening_balance: a.row.opening_balance,
            interest_rate_bps: a.row.interest_rate_bps,
            archived: a.row.archived,
            import_fingerprint: a.fp,
          }))
        )
        .select('id, import_fingerprint')
      if (error) throw new Error(error.message)
      for (const row of data ?? []) {
        if (row.import_fingerprint) {
          accountFpToId.set(String(row.import_fingerprint), String(row.id))
        }
      }
    }

    // 2. Categories — parents (no parentFp) before children.
    const categoryFpToId = new Map<string, string>()
    for (const c of plan.categories) {
      if (c.status === 'duplicate' && c.existingId) {
        categoryFpToId.set(c.fp, c.existingId)
      }
    }
    const insertCategories = async (items: typeof plan.categories) => {
      if (items.length === 0) return
      const { data, error } = await supabase
        .from('categories')
        .insert(
          items.map((c) => ({
            user_id: userId,
            parent_id: c.parentFp
              ? (categoryFpToId.get(c.parentFp) ?? null)
              : null,
            name: c.row.name,
            name_key: c.row.name_key,
            kind: c.row.kind,
            is_default: c.row.is_default,
            icon_name: c.row.icon_name,
            color: c.row.color,
            import_fingerprint: c.fp,
          }))
        )
        .select('id, import_fingerprint')
      if (error) throw new Error(error.message)
      for (const row of data ?? []) {
        if (row.import_fingerprint) {
          categoryFpToId.set(String(row.import_fingerprint), String(row.id))
        }
      }
    }
    await insertCategories(
      plan.categories.filter((c) => c.status === 'new' && c.parentFp === '')
    )
    await insertCategories(
      plan.categories.filter((c) => c.status === 'new' && c.parentFp !== '')
    )

    // 3. Transactions — fingerprint with the resolved account id (CSV-compatible).
    const transferGroupRemap = new Map<string, string>()
    const txnRows = plan.transactions
      .filter((t) => accountFpToId.has(t.accountFp))
      .map((t) => {
        const accountId = accountFpToId.get(t.accountFp) as string
        const oldGroup = t.row.transfer_group_id
        let transferGroupId: string | null = null
        if (oldGroup) {
          transferGroupId = transferGroupRemap.get(oldGroup) ?? randomUUID()
          transferGroupRemap.set(oldGroup, transferGroupId)
        }
        return {
          user_id: userId,
          account_id: accountId,
          category_id: t.categoryFp
            ? (categoryFpToId.get(t.categoryFp) ?? null)
            : null,
          amount_cents: t.row.amount_cents,
          currency: t.row.currency,
          occurred_at: t.row.occurred_at,
          description: t.row.description,
          note: t.row.note,
          tags: t.row.tags,
          is_transfer: t.row.is_transfer,
          transfer_group_id: transferGroupId,
          is_recurring: t.row.is_recurring,
          import_fingerprint: transactionFingerprint({
            accountId,
            amountCents: t.row.amount_cents,
            description: t.row.description,
            occurredAt: t.row.occurred_at,
          }),
        }
      })
    if (txnRows.length > 0) {
      const { error } = await supabase.from('transactions').upsert(txnRows, {
        onConflict: 'user_id,import_fingerprint',
        ignoreDuplicates: true,
      })
      if (error) throw new Error(error.message)
    }

    const totals = sumCounts(plan.counts)
    return {
      ok: true,
      counts: plan.counts,
      committed: totals.new,
      skipped: totals.duplicate,
      errors: totals.error,
    }
  } catch {
    return { ok: false, error: 'unexpected' }
  }
}
