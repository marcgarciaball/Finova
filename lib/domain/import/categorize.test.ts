import { describe, expect, it } from 'vitest'
import type { Clause, Rule } from '@/lib/domain/rules/types'
import type { RawTxn } from './adapter'
import { applyImportCategorization } from './categorize'

const ACCOUNT = '22222222-2222-4222-8222-222222222222'

const txn = (description: string, amountCents = -1000): RawTxn => ({
  amountCents,
  description,
  occurredAt: '2026-01-15',
})

const rule = (over: Partial<Rule> & { conditions: Clause[] }): Rule => ({
  id: 'r1',
  categoryId: 'cat-default',
  priority: 0,
  enabled: true,
  ...over,
})

describe('applyImportCategorization', () => {
  it('returns null for every row when no rules are given', () => {
    const txns = [txn('Coffee'), txn('Rent'), txn('Salary')]
    expect(applyImportCategorization(txns, [], ACCOUNT)).toEqual([
      null,
      null,
      null,
    ])
  })

  it('preserves length and index alignment for an empty input', () => {
    expect(applyImportCategorization([], [], ACCOUNT)).toEqual([])
  })

  it('resolves a matching rule to its category, index-aligned', () => {
    const rules = [
      rule({
        categoryId: 'cat-groceries',
        conditions: [
          { field: 'description', op: 'contains', value: 'mercadona' },
        ],
      }),
    ]
    const txns = [txn('MERCADONA BCN'), txn('Rent'), txn('Lidl mercadona')]
    expect(applyImportCategorization(txns, rules, ACCOUNT)).toEqual([
      'cat-groceries',
      null,
      'cat-groceries',
    ])
  })

  it('honors priority — the highest-priority matching rule wins', () => {
    const rules = [
      rule({
        id: 'lo',
        categoryId: 'cat-lo',
        priority: 10,
        conditions: [{ field: 'description', op: 'contains', value: 'shop' }],
      }),
      rule({
        id: 'hi',
        categoryId: 'cat-hi',
        priority: 1,
        conditions: [{ field: 'description', op: 'contains', value: 'shop' }],
      }),
    ]
    expect(
      applyImportCategorization([txn('Coffee Shop')], rules, ACCOUNT)
    ).toEqual(['cat-hi'])
  })

  it('uses the batch account for account_id clauses', () => {
    const rules = [
      rule({
        categoryId: 'cat-acct',
        conditions: [{ field: 'account_id', op: 'eq', value: ACCOUNT }],
      }),
    ]
    expect(
      applyImportCategorization([txn('anything')], rules, ACCOUNT)
    ).toEqual(['cat-acct'])
    expect(
      applyImportCategorization([txn('anything')], rules, 'other-account')
    ).toEqual([null])
  })
})
