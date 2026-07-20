import { describe, expect, it } from 'vitest'
import {
  type MatchableTxn,
  matchesClause,
  matchesRule,
  orderRules,
  selectCategory,
} from '@/lib/domain/rules/match'
import type { Clause, Rule } from '@/lib/domain/rules/types'

const ACCOUNT = '22222222-2222-4222-8222-222222222222'
const OTHER_ACCOUNT = '99999999-9999-4999-8999-999999999999'

function txn(over: Partial<MatchableTxn> = {}): MatchableTxn {
  return {
    description: 'MERCADONA Barcelona',
    amountCents: -4250,
    accountId: ACCOUNT,
    ...over,
  }
}

function rule(over: Partial<Rule> & { conditions: Clause[] }): Rule {
  return {
    id: 'r1',
    categoryId: 'cat-default',
    priority: 0,
    enabled: true,
    ...over,
  }
}

describe('matchesClause — description', () => {
  it('contains is case-insensitive', () => {
    expect(
      matchesClause(
        { field: 'description', op: 'contains', value: 'mercadona' },
        txn()
      )
    ).toBe(true)
  })

  it('contains returns false when absent', () => {
    expect(
      matchesClause(
        { field: 'description', op: 'contains', value: 'lidl' },
        txn()
      )
    ).toBe(false)
  })

  it('equals matches the whole string, case-insensitively', () => {
    expect(
      matchesClause(
        { field: 'description', op: 'equals', value: 'mercadona barcelona' },
        txn()
      )
    ).toBe(true)
    expect(
      matchesClause(
        { field: 'description', op: 'equals', value: 'mercadona' },
        txn()
      )
    ).toBe(false)
  })

  it('starts_with matches a prefix, case-insensitively', () => {
    expect(
      matchesClause(
        { field: 'description', op: 'starts_with', value: 'merca' },
        txn()
      )
    ).toBe(true)
    expect(
      matchesClause(
        { field: 'description', op: 'starts_with', value: 'barcelona' },
        txn()
      )
    ).toBe(false)
  })

  it('regex matches case-insensitively', () => {
    expect(
      matchesClause(
        { field: 'description', op: 'regex', value: '^merca.*barcelona$' },
        txn()
      )
    ).toBe(true)
  })

  it('an invalid regex returns false instead of throwing', () => {
    expect(
      matchesClause({ field: 'description', op: 'regex', value: '(' }, txn())
    ).toBe(false)
  })
})

describe('matchesClause — amount_cents', () => {
  it('compares the signed value by default', () => {
    // -4250 < -1000 is true (a bigger expense)
    expect(
      matchesClause(
        { field: 'amount_cents', op: 'lt', value: -1000 },
        txn({ amountCents: -4250 })
      )
    ).toBe(true)
  })

  it('gte / lte / gt / eq behave on the signed value', () => {
    const t = txn({ amountCents: 5000 })
    expect(
      matchesClause({ field: 'amount_cents', op: 'gte', value: 5000 }, t)
    ).toBe(true)
    expect(
      matchesClause({ field: 'amount_cents', op: 'gt', value: 5000 }, t)
    ).toBe(false)
    expect(
      matchesClause({ field: 'amount_cents', op: 'eq', value: 5000 }, t)
    ).toBe(true)
    expect(
      matchesClause({ field: 'amount_cents', op: 'lte', value: 4999 }, t)
    ).toBe(false)
  })

  it('absolute compares the magnitude (expense matches a positive threshold)', () => {
    expect(
      matchesClause(
        { field: 'amount_cents', op: 'gte', value: 4000, absolute: true },
        txn({ amountCents: -4250 })
      )
    ).toBe(true)
    // Without absolute, a -4250 is not >= 4000.
    expect(
      matchesClause(
        { field: 'amount_cents', op: 'gte', value: 4000 },
        txn({ amountCents: -4250 })
      )
    ).toBe(false)
  })
})

describe('matchesClause — account_id', () => {
  it('matches the owning account', () => {
    expect(
      matchesClause({ field: 'account_id', op: 'eq', value: ACCOUNT }, txn())
    ).toBe(true)
  })

  it('rejects a different account', () => {
    expect(
      matchesClause(
        { field: 'account_id', op: 'eq', value: OTHER_ACCOUNT },
        txn()
      )
    ).toBe(false)
  })
})

describe('matchesRule — AND semantics', () => {
  it('matches only when every clause holds', () => {
    const r = rule({
      conditions: [
        { field: 'description', op: 'contains', value: 'mercadona' },
        { field: 'amount_cents', op: 'lt', value: 0 },
      ],
    })
    expect(matchesRule(r, txn({ amountCents: -100 }))).toBe(true)
    // Description matches but amount is income (>= 0) → no match.
    expect(matchesRule(r, txn({ amountCents: 100 }))).toBe(false)
  })

  it('ignores the enabled flag (selection handles that)', () => {
    const r = rule({
      enabled: false,
      conditions: [
        { field: 'description', op: 'contains', value: 'mercadona' },
      ],
    })
    expect(matchesRule(r, txn())).toBe(true)
  })
})

describe('orderRules', () => {
  it('drops disabled rules and sorts enabled ones by priority, stable on ties', () => {
    const rules = [
      rule({ id: 'a', priority: 5, conditions: [] }),
      rule({ id: 'b', priority: 1, enabled: false, conditions: [] }),
      rule({ id: 'c', priority: 1, conditions: [] }),
      rule({ id: 'd', priority: 1, conditions: [] }),
    ]
    expect(orderRules(rules).map((r) => r.id)).toEqual(['c', 'd', 'a'])
  })
})

describe('selectCategory', () => {
  it('returns null when no rule matches', () => {
    const r = rule({
      conditions: [{ field: 'description', op: 'contains', value: 'lidl' }],
    })
    expect(selectCategory([r], txn())).toBeNull()
  })

  it('returns null for an empty rule list', () => {
    expect(selectCategory([], txn())).toBeNull()
  })

  it('lower priority number wins', () => {
    const lo = rule({
      id: 'lo',
      categoryId: 'cat-lo',
      priority: 10,
      conditions: [
        { field: 'description', op: 'contains', value: 'mercadona' },
      ],
    })
    const hi = rule({
      id: 'hi',
      categoryId: 'cat-hi',
      priority: 1,
      conditions: [
        { field: 'description', op: 'contains', value: 'mercadona' },
      ],
    })
    // Pass in the "wrong" order to prove it sorts, not just takes the first.
    expect(selectCategory([lo, hi], txn())).toBe('cat-hi')
  })

  it('skips a disabled higher-priority rule for an enabled lower one', () => {
    const disabledTop = rule({
      id: 'top',
      categoryId: 'cat-top',
      priority: 0,
      enabled: false,
      conditions: [
        { field: 'description', op: 'contains', value: 'mercadona' },
      ],
    })
    const enabledNext = rule({
      id: 'next',
      categoryId: 'cat-next',
      priority: 5,
      conditions: [
        { field: 'description', op: 'contains', value: 'mercadona' },
      ],
    })
    expect(selectCategory([disabledTop, enabledNext], txn())).toBe('cat-next')
  })

  it('breaks priority ties by input order (created_at order)', () => {
    const first = rule({
      id: 'first',
      categoryId: 'cat-first',
      priority: 3,
      conditions: [
        { field: 'description', op: 'contains', value: 'mercadona' },
      ],
    })
    const second = rule({
      id: 'second',
      categoryId: 'cat-second',
      priority: 3,
      conditions: [
        { field: 'description', op: 'contains', value: 'mercadona' },
      ],
    })
    expect(selectCategory([first, second], txn())).toBe('cat-first')
  })
})
