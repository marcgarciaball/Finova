import { describe, expect, it } from 'vitest'
import type { MatchableTxn } from './match'
import { previewRuleMatches } from './preview'
import type { RuleConditions } from './types'

const ACCOUNT = '22222222-2222-4222-8222-222222222222'

const txn = (
  description: string,
  over: Partial<MatchableTxn> = {}
): MatchableTxn => ({
  description,
  amountCents: -1000,
  accountId: ACCOUNT,
  ...over,
})

const groceries: RuleConditions = [
  { field: 'description', op: 'contains', value: 'mercadona' },
]

describe('previewRuleMatches', () => {
  it('counts matches and total, and returns the matched rows', () => {
    const txns = [
      txn('MERCADONA BCN'),
      txn('Rent'),
      txn('compra mercadona online'),
    ]
    const result = previewRuleMatches(groceries, txns)
    expect(result.total).toBe(3)
    expect(result.matched).toBe(2)
    expect(result.rows.map((r) => r.description)).toEqual([
      'MERCADONA BCN',
      'compra mercadona online',
    ])
  })

  it('returns zero matches when nothing fits', () => {
    const result = previewRuleMatches(groceries, [txn('Lidl'), txn('Rent')])
    expect(result).toMatchObject({ total: 2, matched: 0 })
    expect(result.rows).toEqual([])
  })

  it('caps the returned sample rows at the limit but counts all matches', () => {
    const many = Array.from({ length: 10 }, () => txn('MERCADONA'))
    const result = previewRuleMatches(groceries, many, { limit: 3 })
    expect(result.matched).toBe(10)
    expect(result.rows).toHaveLength(3)
  })

  it('applies AND semantics across clauses', () => {
    const conditions: RuleConditions = [
      { field: 'description', op: 'contains', value: 'mercadona' },
      { field: 'amount_cents', op: 'lt', value: -5000 },
    ]
    const txns = [
      txn('MERCADONA', { amountCents: -6000 }),
      txn('MERCADONA', { amountCents: -100 }),
    ]
    expect(previewRuleMatches(conditions, txns).matched).toBe(1)
  })
})
