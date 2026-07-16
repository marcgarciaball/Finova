/**
 * Pure planner for round-trip transactions import (Spec D). Classifies accounts,
 * the two-level category tree, and transactions against the user's existing
 * fingerprints. Transactions are the subtle one: their dedup key is the CSV
 * importer's `transactionFingerprint`, which is keyed on the *resolved* account
 * DB id — so the planner only fingerprints a transaction when its account
 * already exists (real id known); transactions under a brand-new account are
 * necessarily new. The commit action computes the stored fingerprint once the
 * account id is resolved. No I/O.
 */
import type { ExportInput } from '@/lib/domain/export/bundle'
import type { AccountRow } from '@/lib/validation/account'
import type { CategoryRow } from '@/lib/validation/category'
import type { TransactionRow } from '@/lib/validation/transaction'
import {
  accountFingerprint,
  categoryFingerprint,
  transactionFingerprint,
} from './transactions-fingerprint'

export type TransactionsTable = 'accounts' | 'categories' | 'transactions'

export interface TableCounts {
  duplicate: number
  error: number
  new: number
}

export interface PlannedTxnAccount {
  existingId?: string
  fp: string
  row: AccountRow
  status: 'new' | 'duplicate'
}

export interface PlannedCategory {
  existingId?: string
  fp: string
  /** Parent category fingerprint (empty string for a top-level category). */
  parentFp: string
  row: CategoryRow
  status: 'new' | 'duplicate'
}

export interface PlannedTransaction {
  accountFp: string
  categoryFp: string | null
  row: TransactionRow
}

export interface TransactionsImportPlan {
  accounts: PlannedTxnAccount[]
  categories: PlannedCategory[]
  counts: Record<TransactionsTable, TableCounts>
  /** New transactions only. */
  transactions: PlannedTransaction[]
}

export interface ExistingTransactions {
  accountIdByFp: Map<string, string>
  categoryIdByFp: Map<string, string>
  /** transactionFingerprint values of existing rows (keyed on real account id). */
  txnFps: Set<string>
}

const zeroCounts = (): TableCounts => ({ new: 0, duplicate: 0, error: 0 })

export function planTransactionsImport(
  parsed: ExportInput,
  existing: ExistingTransactions
): TransactionsImportPlan {
  const counts: Record<TransactionsTable, TableCounts> = {
    accounts: zeroCounts(),
    categories: zeroCounts(),
    transactions: zeroCounts(),
  }

  // --- Accounts -----------------------------------------------------------
  const accounts: PlannedTxnAccount[] = []
  const accountFpByExportId = new Map<string, string>()
  const seenAccountFp = new Set<string>()
  for (const row of parsed.accounts) {
    const fp = accountFingerprint(row)
    accountFpByExportId.set(row.id, fp)
    if (seenAccountFp.has(fp)) continue
    seenAccountFp.add(fp)
    const existingId = existing.accountIdByFp.get(fp)
    if (existingId) {
      counts.accounts.duplicate++
      accounts.push({ fp, status: 'duplicate', existingId, row })
    } else {
      counts.accounts.new++
      accounts.push({ fp, status: 'new', row })
    }
  }

  // --- Categories (two-level tree) ----------------------------------------
  const categoryById = new Map<string, CategoryRow>()
  for (const c of parsed.categories) categoryById.set(c.id, c)

  const categories: PlannedCategory[] = []
  const categoryFpByExportId = new Map<string, string>()
  const seenCategoryFp = new Set<string>()
  for (const row of parsed.categories) {
    let parentFp = ''
    if (row.parent_id) {
      const parent = categoryById.get(row.parent_id)
      if (parent) parentFp = categoryFingerprint(parent.kind, parent.name, '')
    }
    const fp = categoryFingerprint(row.kind, row.name, parentFp)
    categoryFpByExportId.set(row.id, fp)
    if (seenCategoryFp.has(fp)) continue
    seenCategoryFp.add(fp)
    const existingId = existing.categoryIdByFp.get(fp)
    if (existingId) {
      counts.categories.duplicate++
      categories.push({ fp, parentFp, status: 'duplicate', existingId, row })
    } else {
      counts.categories.new++
      categories.push({ fp, parentFp, status: 'new', row })
    }
  }

  // --- Transactions -------------------------------------------------------
  const transactions: PlannedTransaction[] = []
  const seenTxnKey = new Set<string>()
  for (const row of parsed.transactions) {
    const accountFp = accountFpByExportId.get(row.account_id)
    if (!accountFp) {
      counts.transactions.error++ // account not in the file
      continue
    }
    const categoryFp = row.category_id
      ? (categoryFpByExportId.get(row.category_id) ?? null)
      : null

    // Within-file dedup key (account identity + content).
    const dateKey = row.occurred_at.slice(0, 10)
    const withinKey = [
      accountFp,
      row.amount_cents,
      row.description,
      dateKey,
    ].join('|')
    if (seenTxnKey.has(withinKey)) {
      counts.transactions.duplicate++
      continue
    }
    seenTxnKey.add(withinKey)

    // Against existing rows: only computable when the account already exists
    // (the fingerprint needs its real DB id). New-account transactions are new.
    const existingAccountId = existing.accountIdByFp.get(accountFp)
    if (existingAccountId) {
      const fp = transactionFingerprint({
        accountId: existingAccountId,
        amountCents: row.amount_cents,
        description: row.description,
        occurredAt: row.occurred_at,
      })
      if (existing.txnFps.has(fp)) {
        counts.transactions.duplicate++
        continue
      }
    }
    counts.transactions.new++
    transactions.push({ accountFp, categoryFp, row })
  }

  return { counts, accounts, categories, transactions }
}
