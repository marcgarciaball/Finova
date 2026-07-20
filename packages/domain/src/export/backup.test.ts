import { describe, expect, it } from 'vitest'
import type { AccountRow } from '@/lib/validation/account'
import type {
  InvestmentTransactionRow,
  PortfolioRow,
} from '@/lib/validation/investments'
import type { PropertyRow } from '@/lib/validation/real-estate'
import { parseCsv, rowsToRecords } from '../import/csv'
import {
  type AssetRef,
  BACKUP_SCHEMA_VERSION,
  buildBackupBundle,
  INVESTMENT_TRANSACTIONS_HEADER,
  investmentTransactionsCsv,
  PROPERTIES_HEADER,
  propertiesCsv,
} from './bundle'

const META = { exportedAt: '2026-07-15T00:00:00Z' }

const account = (over: Partial<AccountRow> = {}): AccountRow => ({
  id: 'a1',
  user_id: 'u1',
  name: 'Checking',
  type: 'checking',
  currency: 'EUR',
  opening_balance: 0,
  interest_rate_bps: null,
  archived: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
})

const portfolio = (over: Partial<PortfolioRow> = {}): PortfolioRow => ({
  id: 'p1',
  user_id: 'u1',
  name: 'Main',
  base_currency: 'EUR',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
})

const asset = (over: Partial<AssetRef> = {}): AssetRef => ({
  id: 'as1',
  type: 'stock',
  ticker: 'AAPL',
  isin: null,
  coingecko_id: null,
  exchange: 'NASDAQ',
  name: 'Apple Inc.',
  currency: 'USD',
  ...over,
})

const invTxn = (
  over: Partial<InvestmentTransactionRow> = {}
): InvestmentTransactionRow => ({
  id: 'it1',
  user_id: 'u1',
  portfolio_id: 'p1',
  account_id: null,
  asset_id: 'as1',
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

const property = (over: Partial<PropertyRow> = {}): PropertyRow => ({
  id: 'pr1',
  user_id: 'u1',
  name: 'Piso Xirivella',
  type: 'investment',
  address: null,
  city: 'Xirivella',
  country: 'ES',
  currency: 'EUR',
  purchase_date: '2020-01-15',
  purchase_price_cents: 12_000_000,
  purchase_fees_cents: 500_000,
  current_value_cents: 15_000_000,
  last_valued_at: '2026-01-01',
  is_rented: true,
  rental_start_date: '2021-01-01',
  rental_end_date: null,
  is_sold: false,
  sold_date: null,
  sold_price_cents: null,
  sold_fees_cents: null,
  notes: null,
  created_at: '2020-01-15T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
})

describe('buildBackupBundle', () => {
  it('stamps the versioned meta and only the domains supplied', () => {
    const bundle = buildBackupBundle(
      {
        realEstate: {
          properties: [property()],
          loans: [],
          valuations: [],
          income: [],
          expenses: [],
        },
      },
      META
    ) as {
      meta: {
        app: string
        schemaVersion: number
        domains: string[]
        counts: Record<string, unknown>
      }
      realEstate?: unknown
      transactions?: unknown
      investments?: unknown
    }

    expect(bundle.meta.app).toBe('finova')
    expect(bundle.meta.schemaVersion).toBe(BACKUP_SCHEMA_VERSION)
    expect(bundle.meta.domains).toEqual(['realEstate'])
    expect(bundle.realEstate).toBeDefined()
    expect(bundle.transactions).toBeUndefined()
    expect(bundle.investments).toBeUndefined()
  })

  it('records per-domain counts and preserves domain order', () => {
    const bundle = buildBackupBundle(
      {
        transactions: {
          accounts: [account()],
          categories: [],
          transactions: [],
        },
        investments: {
          portfolios: [portfolio()],
          accounts: [],
          assets: [asset()],
          transactions: [invTxn()],
        },
      },
      META
    ) as {
      meta: {
        domains: string[]
        counts: Record<string, Record<string, number>>
      }
    }

    expect(bundle.meta.domains).toEqual(['transactions', 'investments'])
    expect(bundle.meta.counts.transactions.accounts).toBe(1)
    expect(bundle.meta.counts.investments.assets).toBe(1)
    expect(bundle.meta.counts.investments.transactions).toBe(1)
  })

  it('counts rules + import templates when present (GDPR completeness)', () => {
    const bundle = buildBackupBundle(
      {
        transactions: {
          accounts: [],
          categories: [],
          transactions: [],
          // biome-ignore lint/suspicious/noExplicitAny: count-only test fixture
          rules: [{} as any, {} as any],
          // biome-ignore lint/suspicious/noExplicitAny: count-only test fixture
          importTemplates: [{} as any],
        },
      },
      META
    ) as {
      meta: {
        counts: { transactions: { rules?: number; importTemplates?: number } }
      }
    }
    expect(bundle.meta.counts.transactions.rules).toBe(2)
    expect(bundle.meta.counts.transactions.importTemplates).toBe(1)
  })

  it('omits rules/importTemplates counts when absent', () => {
    const bundle = buildBackupBundle(
      { transactions: { accounts: [], categories: [], transactions: [] } },
      META
    ) as {
      meta: { counts: { transactions: Record<string, number> } }
    }
    expect('rules' in bundle.meta.counts.transactions).toBe(false)
    expect('importTemplates' in bundle.meta.counts.transactions).toBe(false)
  })

  it('includes filters only when non-empty', () => {
    const bare = buildBackupBundle(
      { transactions: { accounts: [], categories: [], transactions: [] } },
      META
    ) as {
      meta: { filters?: unknown }
    }
    expect(bare.meta.filters).toBeUndefined()

    const filtered = buildBackupBundle(
      { transactions: { accounts: [], categories: [], transactions: [] } },
      { ...META, filters: { from: '2026-01-01' } }
    ) as { meta: { filters?: Record<string, string> } }
    expect(filtered.meta.filters).toEqual({ from: '2026-01-01' })
  })
})

describe('investmentTransactionsCsv', () => {
  it('writes a stable header with no rows', () => {
    expect(investmentTransactionsCsv([], [])).toBe(
      INVESTMENT_TRANSACTIONS_HEADER.join(',')
    )
  })

  it('resolves the asset label and emits major-unit money', () => {
    const csv = investmentTransactionsCsv([invTxn()], [asset()])
    const [record] = rowsToRecords(parseCsv(csv))
    expect(record.asset).toBe('Apple Inc.')
    expect(record.ticker).toBe('AAPL')
    expect(record.quantity).toBe('10')
    expect(record.price).toBe('150')
    expect(record.fees).toBe('1')
  })

  it('leaves the asset label blank when the ref is missing', () => {
    const csv = investmentTransactionsCsv([invTxn({ asset_id: 'gone' })], [])
    const [record] = rowsToRecords(parseCsv(csv))
    expect(record.asset).toBe('')
    expect(record.asset_id).toBe('gone')
  })
})

describe('propertiesCsv', () => {
  it('writes a stable header with no rows', () => {
    expect(propertiesCsv([])).toBe(PROPERTIES_HEADER.join(','))
  })

  it('emits major-unit money and blanks nullable sold columns', () => {
    const [record] = rowsToRecords(parseCsv(propertiesCsv([property()])))
    expect(record.purchase_price).toBe('120000')
    expect(record.current_value).toBe('150000')
    expect(record.is_rented).toBe('true')
    expect(record.sold_price).toBe('')
    expect(record.sold_fees).toBe('')
  })
})
