import { describe, expect, it } from 'vitest'
import type { ExportInput } from '@/lib/domain/export/bundle'
import type { AccountRow } from '@/lib/validation/account'
import type { CategoryRow } from '@/lib/validation/category'
import type { TransactionRow } from '@/lib/validation/transaction'
import {
  accountFingerprint,
  categoryFingerprint,
  transactionFingerprint,
} from './transactions-fingerprint'
import {
  type ExistingTransactions,
  planTransactionsImport,
} from './transactions-plan'

const account = (over: Partial<AccountRow> = {}): AccountRow => ({
  id: 'export-a1',
  user_id: 'exporter',
  name: 'Sabadell',
  type: 'checking',
  currency: 'EUR',
  opening_balance: 0,
  interest_rate_bps: null,
  archived: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
})

const category = (over: Partial<CategoryRow> = {}): CategoryRow => ({
  id: 'export-c1',
  user_id: 'exporter',
  parent_id: null,
  name: 'Food',
  name_key: null,
  kind: 'expense',
  is_default: false,
  icon_name: null,
  color: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
})

const txn = (over: Partial<TransactionRow> = {}): TransactionRow => ({
  id: 'export-t1',
  user_id: 'exporter',
  account_id: 'export-a1',
  category_id: 'export-c1',
  amount_cents: -350,
  currency: 'EUR',
  occurred_at: '2026-06-20T00:00:00Z',
  description: 'Coffee',
  note: null,
  tags: [],
  is_transfer: false,
  transfer_group_id: null,
  is_recurring: false,
  created_at: '2026-06-20T00:00:00Z',
  updated_at: '2026-06-20T00:00:00Z',
  ...over,
})

const input = (over: Partial<ExportInput> = {}): ExportInput => ({
  accounts: [account()],
  categories: [category()],
  transactions: [txn()],
  ...over,
})

const emptyExisting = (): ExistingTransactions => ({
  accountIdByFp: new Map(),
  categoryIdByFp: new Map(),
  txnFps: new Set(),
})

describe('planTransactionsImport', () => {
  it('marks everything new against an empty account', () => {
    const plan = planTransactionsImport(input(), emptyExisting())
    expect(plan.counts.accounts.new).toBe(1)
    expect(plan.counts.categories.new).toBe(1)
    expect(plan.counts.transactions.new).toBe(1)
    expect(plan.transactions[0].accountFp).toBe(accountFingerprint(account()))
  })

  it('fingerprints a subcategory with its parent identity', () => {
    const parent = category({ id: 'p', name: 'Home' })
    const child = category({ id: 'c', name: 'Rent', parent_id: 'p' })
    const plan = planTransactionsImport(
      input({ categories: [parent, child], transactions: [] }),
      emptyExisting()
    )
    const parentFp = categoryFingerprint('expense', 'Home', '')
    const childPlanned = plan.categories.find((c) => c.row.id === 'c')
    expect(childPlanned?.parentFp).toBe(parentFp)
    expect(childPlanned?.fp).toBe(
      categoryFingerprint('expense', 'Rent', parentFp)
    )
  })

  it('skips a transaction that already exists under an existing account', () => {
    const aFp = accountFingerprint(account())
    const existingFp = transactionFingerprint({
      accountId: 'db-a1',
      amountCents: -350,
      description: 'Coffee',
      occurredAt: '2026-06-20T00:00:00Z',
    })
    const existing: ExistingTransactions = {
      accountIdByFp: new Map([[aFp, 'db-a1']]),
      categoryIdByFp: new Map([
        [categoryFingerprint('expense', 'Food', ''), 'db-c1'],
      ]),
      txnFps: new Set([existingFp]),
    }
    const plan = planTransactionsImport(input(), existing)
    expect(plan.counts.transactions.duplicate).toBe(1)
    expect(plan.transactions).toHaveLength(0)
    expect(plan.accounts[0]).toMatchObject({ existingId: 'db-a1' })
  })

  it('treats transactions under a brand-new account as new', () => {
    // Account is new (not in existing), but txnFps contains a same-content fp
    // for a different account — must not false-match.
    const existing: ExistingTransactions = {
      accountIdByFp: new Map(),
      categoryIdByFp: new Map(),
      txnFps: new Set([
        transactionFingerprint({
          accountId: 'some-other-account',
          amountCents: -350,
          description: 'Coffee',
          occurredAt: '2026-06-20T00:00:00Z',
        }),
      ]),
    }
    const plan = planTransactionsImport(input(), existing)
    expect(plan.counts.transactions.new).toBe(1)
  })

  it('errors a transaction whose account is missing from the file', () => {
    const plan = planTransactionsImport(
      input({ accounts: [], transactions: [txn()] }),
      emptyExisting()
    )
    expect(plan.counts.transactions.error).toBe(1)
  })
})
