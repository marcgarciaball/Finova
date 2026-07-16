/**
 * Pure planner for round-trip investments import (Spec C). Classifies
 * portfolios, accounts and transactions against the user's existing
 * fingerprints and resolves every reference — portfolio, account, asset — by an
 * id-independent key so it survives the import's UUID remap. Assets are
 * resolved to real DB ids by the commit action (a symbol match or an admin
 * upsert); the planner only carries the export asset id + the ref needed for
 * that. No I/O.
 */
import type {
  AssetRef,
  InvestmentsExportInput,
} from '@/lib/domain/export/bundle'
import type {
  InvestmentAccountRow,
  InvestmentTransactionRow,
  PortfolioRow,
} from '@/lib/validation/investments'
import {
  accountFingerprint,
  assetKey,
  investmentTxnFingerprint,
  portfolioFingerprint,
} from './investments-fingerprint'

export type InvestmentsTable = 'portfolios' | 'accounts' | 'transactions'

export interface TableCounts {
  duplicate: number
  error: number
  new: number
}

export interface PlannedInvestmentRow<T> {
  existingId?: string
  fp: string
  row: T
  status: 'new' | 'duplicate'
}

export interface PlannedInvestmentAccount
  extends PlannedInvestmentRow<InvestmentAccountRow> {
  parentPortfolioFp: string
}

export interface PlannedInvestmentTxn {
  accountFp: string | null
  assetExportId: string
  fp: string
  parentPortfolioFp: string
  row: InvestmentTransactionRow
}

export interface InvestmentsImportPlan {
  accounts: PlannedInvestmentAccount[]
  /** Every asset ref keyed by its export id (commit resolves these to DB ids). */
  assetsByExportId: Map<string, AssetRef>
  counts: Record<InvestmentsTable, TableCounts>
  portfolios: PlannedInvestmentRow<PortfolioRow>[]
  /** New transactions only. */
  transactions: PlannedInvestmentTxn[]
}

export interface ExistingInvestments {
  accountIdByFp: Map<string, string>
  portfolioIdByFp: Map<string, string>
  txnFps: Set<string>
}

const zeroCounts = (): TableCounts => ({ new: 0, duplicate: 0, error: 0 })

export function planInvestmentsImport(
  parsed: InvestmentsExportInput,
  existing: ExistingInvestments
): InvestmentsImportPlan {
  const counts: Record<InvestmentsTable, TableCounts> = {
    portfolios: zeroCounts(),
    accounts: zeroCounts(),
    transactions: zeroCounts(),
  }

  // --- Portfolios ---------------------------------------------------------
  const portfolios: PlannedInvestmentRow<PortfolioRow>[] = []
  const portfolioFpByExportId = new Map<string, string>()
  const seenPortfolioFp = new Set<string>()
  for (const row of parsed.portfolios) {
    const fp = portfolioFingerprint(row)
    portfolioFpByExportId.set(row.id, fp)
    if (seenPortfolioFp.has(fp)) continue
    seenPortfolioFp.add(fp)
    const existingId = existing.portfolioIdByFp.get(fp)
    if (existingId) {
      counts.portfolios.duplicate++
      portfolios.push({ fp, status: 'duplicate', existingId, row })
    } else {
      counts.portfolios.new++
      portfolios.push({ fp, status: 'new', row })
    }
  }

  // --- Accounts (parented by portfolio) -----------------------------------
  const accounts: PlannedInvestmentAccount[] = []
  const accountFpByExportId = new Map<string, string>()
  const seenAccountFp = new Set<string>()
  for (const row of parsed.accounts) {
    const parentPortfolioFp = portfolioFpByExportId.get(row.portfolio_id)
    if (!parentPortfolioFp) {
      counts.accounts.error++
      continue
    }
    const fp = accountFingerprint(parentPortfolioFp, row)
    accountFpByExportId.set(row.id, fp)
    if (seenAccountFp.has(fp)) continue
    seenAccountFp.add(fp)
    const existingId = existing.accountIdByFp.get(fp)
    if (existingId) {
      counts.accounts.duplicate++
      accounts.push({
        fp,
        status: 'duplicate',
        existingId,
        parentPortfolioFp,
        row,
      })
    } else {
      counts.accounts.new++
      accounts.push({ fp, status: 'new', parentPortfolioFp, row })
    }
  }

  // --- Assets index (resolved to DB ids at commit) ------------------------
  const assetsByExportId = new Map<string, AssetRef>()
  const assetKeyByExportId = new Map<string, string>()
  for (const a of parsed.assets) {
    assetsByExportId.set(a.id, a)
    assetKeyByExportId.set(a.id, assetKey(a))
  }

  // --- Transactions -------------------------------------------------------
  const transactions: PlannedInvestmentTxn[] = []
  const seenTxnFp = new Set<string>()
  for (const row of parsed.transactions) {
    const parentPortfolioFp = portfolioFpByExportId.get(row.portfolio_id)
    const symbol = assetKeyByExportId.get(row.asset_id)
    if (!parentPortfolioFp || !symbol) {
      counts.transactions.error++ // missing portfolio or asset in the file
      continue
    }
    // An account reference that isn't in the file degrades to "no account"
    // rather than dropping the transaction.
    const accountFp = row.account_id
      ? (accountFpByExportId.get(row.account_id) ?? null)
      : null
    const fp = investmentTxnFingerprint(parentPortfolioFp, symbol, row)
    if (seenTxnFp.has(fp) || existing.txnFps.has(fp)) {
      counts.transactions.duplicate++
      continue
    }
    seenTxnFp.add(fp)
    counts.transactions.new++
    transactions.push({
      fp,
      parentPortfolioFp,
      accountFp,
      assetExportId: row.asset_id,
      row,
    })
  }

  return { counts, portfolios, accounts, transactions, assetsByExportId }
}
