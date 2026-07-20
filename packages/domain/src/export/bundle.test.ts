import { describe, expect, it } from 'vitest'
import type { AccountRow } from '@/lib/validation/account'
import type { CategoryRow } from '@/lib/validation/category'
import type { TransactionRow } from '@/lib/validation/transaction'
import { parseCsv, rowsToRecords } from '../import/csv'
import {
  buildJsonBundle,
  type ExportInput,
  TRANSACTIONS_HEADER,
  transactionsCsv,
} from './bundle'

const txn = (over: Partial<TransactionRow> = {}): TransactionRow => ({
  id: 't1',
  user_id: 'u1',
  account_id: 'a1',
  category_id: 'c1',
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

describe('transactionsCsv', () => {
  it('writes a stable header even with no rows', () => {
    expect(transactionsCsv([])).toBe(TRANSACTIONS_HEADER.join(','))
  })

  it('emits amounts in major units verbatim (no formula-sanitize)', () => {
    const csv = transactionsCsv([
      txn({ amount_cents: -350 }),
      txn({ amount_cents: 200_000 }),
    ])
    const records = rowsToRecords(parseCsv(csv))
    expect(records[0]?.amount).toBe('-3.5')
    expect(records[1]?.amount).toBe('2000')
  })

  it('round-trips through the import parser', () => {
    const csv = transactionsCsv([
      txn({
        description: 'Coffee, large',
        amount_cents: -350,
        tags: ['food', 'cafe'],
      }),
    ])
    const records = rowsToRecords(parseCsv(csv))
    expect(records[0]).toMatchObject({
      description: 'Coffee, large',
      amount: '-3.5',
      currency: 'EUR',
      tags: 'food;cafe',
      is_transfer: 'false',
    })
  })

  it('sanitizes a description that starts with a formula trigger', () => {
    const csv = transactionsCsv([txn({ description: '=cmd()' })])
    const records = rowsToRecords(parseCsv(csv))
    expect(records[0]?.description).toBe("'=cmd()")
  })
})

const EMPTY_INPUT = {
  accounts: [],
  categories: [],
  transactions: [],
} satisfies ExportInput

describe('buildJsonBundle', () => {
  const accounts = [{ id: 'a1', name: 'Checking' }] as unknown as AccountRow[]
  const categories = [{ id: 'c1', name: 'Food' }] as unknown as CategoryRow[]

  it('includes meta + all three arrays', () => {
    const bundle = buildJsonBundle(
      { accounts, categories, transactions: [txn()] },
      { exportedAt: '2026-06-28T12:00:00Z', version: '1' }
    ) as Record<string, unknown>

    expect(bundle.meta).toEqual({
      exportedAt: '2026-06-28T12:00:00Z',
      version: '1',
      counts: { accounts: 1, categories: 1, transactions: 1 },
    })
    expect(bundle.accounts).toEqual(accounts)
    expect(bundle.categories).toEqual(categories)
    expect(Array.isArray(bundle.transactions)).toBe(true)
  })

  it('handles an empty dataset', () => {
    const bundle = buildJsonBundle(
      { accounts: [], categories: [], transactions: [] },
      { exportedAt: '2026-06-28T12:00:00Z', version: '1' }
    ) as Record<string, { counts: unknown }>
    expect((bundle.meta as { counts: unknown }).counts).toEqual({
      accounts: 0,
      categories: 0,
      transactions: 0,
    })
  })
})

describe('buildJsonBundle meta.filters', () => {
  it('records applied filters verbatim when given', () => {
    const bundle = buildJsonBundle(EMPTY_INPUT, {
      exportedAt: '2026-07-03T00:00:00.000Z',
      version: '1',
      filters: { from: '2026-01-01', account: 'acc-1' },
    }) as { meta: { filters?: Record<string, string> } }
    expect(bundle.meta.filters).toEqual({
      from: '2026-01-01',
      account: 'acc-1',
    })
  })

  it('omits the filters key when absent or empty', () => {
    const plain = buildJsonBundle(EMPTY_INPUT, {
      exportedAt: '2026-07-03T00:00:00.000Z',
      version: '1',
    }) as { meta: object }
    expect(plain.meta).not.toHaveProperty('filters')

    const empty = buildJsonBundle(EMPTY_INPUT, {
      exportedAt: '2026-07-03T00:00:00.000Z',
      version: '1',
      filters: {},
    }) as { meta: object }
    expect(empty.meta).not.toHaveProperty('filters')
  })
})
