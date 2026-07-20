import { describe, expect, it } from 'vitest'
import { applyFilters } from './apply-filters'
import { EMPTY_FILTERS, UNCATEGORIZED } from './filters'

/** Chainable stub that records every builder call. */
function fakeQuery() {
  const calls: Array<[string, ...unknown[]]> = []
  // biome-ignore lint/suspicious/noExplicitAny: test stub for the PostgREST chain
  const q: any = {}
  for (const m of ['eq', 'is', 'gte', 'lte', 'lt', 'ilike'] as const) {
    q[m] = (...args: unknown[]) => {
      calls.push([m, ...args])
      return q
    }
  }
  return { q, calls }
}

describe('applyFilters', () => {
  it('applies nothing for empty filters', () => {
    const { q, calls } = fakeQuery()
    applyFilters(q, EMPTY_FILTERS)
    expect(calls).toEqual([])
  })

  it('filters by account and category ids', () => {
    const { q, calls } = fakeQuery()
    applyFilters(q, {
      ...EMPTY_FILTERS,
      accountId: 'acc-1',
      categoryId: 'cat-1',
    })
    expect(calls).toEqual([
      ['eq', 'account_id', 'acc-1'],
      ['eq', 'category_id', 'cat-1'],
    ])
  })

  it('maps the uncategorized sentinel to IS NULL', () => {
    const { q, calls } = fakeQuery()
    applyFilters(q, { ...EMPTY_FILTERS, categoryId: UNCATEGORIZED })
    expect(calls).toEqual([['is', 'category_id', null]])
  })

  it('applies inclusive UTC date bounds', () => {
    const { q, calls } = fakeQuery()
    applyFilters(q, { ...EMPTY_FILTERS, from: '2026-01-01', to: '2026-01-31' })
    expect(calls).toEqual([
      ['gte', 'occurred_at', '2026-01-01T00:00:00Z'],
      ['lte', 'occurred_at', '2026-01-31T23:59:59.999Z'],
    ])
  })

  it('escapes ilike wildcards in the search term', () => {
    const { q, calls } = fakeQuery()
    applyFilters(q, { ...EMPTY_FILTERS, q: '100%_off' })
    expect(calls).toEqual([['ilike', 'description', '%100\\%\\_off%']])
  })

  it('maps the expense type to non-transfer negative amounts', () => {
    const { q, calls } = fakeQuery()
    applyFilters(q, { ...EMPTY_FILTERS, type: 'expense' })
    expect(calls).toEqual([
      ['eq', 'is_transfer', false],
      ['lt', 'amount_cents', 0],
    ])
  })
})
