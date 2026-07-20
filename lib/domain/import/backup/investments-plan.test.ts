import { describe, expect, it } from 'vitest'
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
import {
  type ExistingInvestments,
  planInvestmentsImport,
} from './investments-plan'

const portfolio = (over: Partial<PortfolioRow> = {}): PortfolioRow => ({
  id: 'export-pf1',
  user_id: 'exporter',
  name: 'Main',
  base_currency: 'EUR',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
})

const account = (
  over: Partial<InvestmentAccountRow> = {}
): InvestmentAccountRow => ({
  id: 'export-ac1',
  portfolio_id: 'export-pf1',
  user_id: 'exporter',
  name: 'DEGIRO',
  currency: 'EUR',
  created_at: '2026-01-01T00:00:00Z',
  ...over,
})

const asset = (over: Partial<AssetRef> = {}): AssetRef => ({
  id: 'export-as1',
  type: 'stock',
  ticker: 'AAPL',
  isin: null,
  coingecko_id: null,
  exchange: 'NASDAQ',
  name: 'Apple Inc.',
  currency: 'USD',
  ...over,
})

const txn = (
  over: Partial<InvestmentTransactionRow> = {}
): InvestmentTransactionRow => ({
  id: 'export-t1',
  user_id: 'exporter',
  portfolio_id: 'export-pf1',
  account_id: 'export-ac1',
  asset_id: 'export-as1',
  type: 'buy',
  quantity: 10,
  price_cents: 15_000,
  currency: 'USD',
  fees_cents: 100,
  traded_at: '2026-03-01',
  notes: null,
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
  edited_at: null,
  edit_reason: null,
  ...over,
})

const input = (
  over: Partial<InvestmentsExportInput> = {}
): InvestmentsExportInput => ({
  portfolios: [portfolio()],
  accounts: [account()],
  assets: [asset()],
  transactions: [txn()],
  ...over,
})

const emptyExisting = (): ExistingInvestments => ({
  portfolioIdByFp: new Map(),
  accountIdByFp: new Map(),
  txnFps: new Set(),
})

describe('planInvestmentsImport', () => {
  it('marks everything new against an empty account', () => {
    const plan = planInvestmentsImport(input(), emptyExisting())
    expect(plan.counts.portfolios.new).toBe(1)
    expect(plan.counts.accounts.new).toBe(1)
    expect(plan.counts.transactions.new).toBe(1)
    expect(plan.transactions[0].assetExportId).toBe('export-as1')
  })

  it('resolves txn references by fingerprint/symbol, not id', () => {
    const plan = planInvestmentsImport(input(), emptyExisting())
    const pFp = portfolioFingerprint(portfolio())
    expect(plan.transactions[0].parentPortfolioFp).toBe(pFp)
    expect(plan.transactions[0].accountFp).toBe(
      accountFingerprint(pFp, account())
    )
  })

  it('skips a transaction that already exists (idempotent)', () => {
    const pFp = portfolioFingerprint(portfolio())
    const existing: ExistingInvestments = {
      portfolioIdByFp: new Map([[pFp, 'db-pf1']]),
      accountIdByFp: new Map([[accountFingerprint(pFp, account()), 'db-ac1']]),
      txnFps: new Set([
        investmentTxnFingerprint(pFp, assetKey(asset()), txn()),
      ]),
    }
    const plan = planInvestmentsImport(input(), existing)
    expect(plan.counts.portfolios.duplicate).toBe(1)
    expect(plan.counts.transactions.duplicate).toBe(1)
    expect(plan.transactions).toHaveLength(0)
    expect(plan.portfolios[0]).toMatchObject({ existingId: 'db-pf1' })
  })

  it('errors a transaction whose asset is missing from the file', () => {
    const plan = planInvestmentsImport(input({ assets: [] }), emptyExisting())
    expect(plan.counts.transactions.error).toBe(1)
    expect(plan.transactions).toHaveLength(0)
  })

  it('degrades an unknown account reference to no account', () => {
    const plan = planInvestmentsImport(
      input({ transactions: [txn({ account_id: 'ghost' })] }),
      emptyExisting()
    )
    expect(plan.transactions[0].accountFp).toBeNull()
    expect(plan.counts.transactions.new).toBe(1)
  })

  it('matches a duplicate even when quantity scale differs (string vs number)', () => {
    const pFp = portfolioFingerprint(portfolio())
    // Existing fingerprint built from a Postgres-style string quantity.
    const existingFp = investmentTxnFingerprint(pFp, assetKey(asset()), {
      type: 'buy',
      traded_at: '2026-03-01',
      quantity: '10.00000000' as unknown as number,
      price_cents: 15_000,
      currency: 'USD',
    })
    const existing: ExistingInvestments = {
      portfolioIdByFp: new Map([[pFp, 'db-pf1']]),
      accountIdByFp: new Map(),
      txnFps: new Set([existingFp]),
    }
    const plan = planInvestmentsImport(
      input({ accounts: [], transactions: [txn({ account_id: null })] }),
      existing
    )
    expect(plan.counts.transactions.duplicate).toBe(1)
  })
})
