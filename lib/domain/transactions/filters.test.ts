import { describe, expect, it } from 'vitest'
import {
  EMPTY_FILTERS,
  filtersToSearchParams,
  hasActiveFilters,
  parseFilters,
  transactionType,
  UNCATEGORIZED,
} from './filters'

const UUID = '11111111-1111-4111-8111-111111111111'

describe('parseFilters', () => {
  it('returns all-null filters for an empty bag', () => {
    expect(parseFilters({})).toEqual(EMPTY_FILTERS)
  })

  it('accepts valid account/category uuids', () => {
    const f = parseFilters({ account: UUID, category: UUID })
    expect(f.accountId).toBe(UUID)
    expect(f.categoryId).toBe(UUID)
  })

  it('drops malformed uuids to null', () => {
    expect(parseFilters({ account: 'nope', category: '123' })).toMatchObject({
      accountId: null,
      categoryId: null,
    })
  })

  it('keeps the uncategorized sentinel', () => {
    expect(parseFilters({ category: UNCATEGORIZED }).categoryId).toBe(
      UNCATEGORIZED
    )
  })

  it('validates type against the allowed set', () => {
    expect(parseFilters({ type: 'income' }).type).toBe('income')
    expect(parseFilters({ type: 'expense' }).type).toBe('expense')
    expect(parseFilters({ type: 'transfer' }).type).toBe('transfer')
    expect(parseFilters({ type: 'bogus' }).type).toBeNull()
  })

  it('validates dates as YYYY-MM-DD', () => {
    expect(parseFilters({ from: '2026-01-31' }).from).toBe('2026-01-31')
    expect(parseFilters({ from: '01/31/2026' }).from).toBeNull()
  })

  it('trims search and treats whitespace-only as absent', () => {
    expect(parseFilters({ q: '  coffee ' }).q).toBe('coffee')
    expect(parseFilters({ q: '   ' }).q).toBeNull()
  })

  it('uses the first value when a param repeats', () => {
    expect(parseFilters({ type: ['expense', 'income'] }).type).toBe('expense')
  })
})

describe('filtersToSearchParams', () => {
  it('omits null fields', () => {
    expect(filtersToSearchParams(EMPTY_FILTERS).toString()).toBe('')
  })

  it('round-trips a populated filter set', () => {
    const f = {
      accountId: UUID,
      categoryId: UNCATEGORIZED,
      type: 'expense' as const,
      from: '2026-01-01',
      to: '2026-01-31',
      q: 'rent',
    }
    const round = parseFilters(Object.fromEntries(filtersToSearchParams(f)))
    expect(round).toEqual(f)
  })
})

describe('hasActiveFilters', () => {
  it('is false for empty filters', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
  })
  it('is true when any field is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, q: 'x' })).toBe(true)
  })
})

describe('transactionType', () => {
  it('classifies transfers first', () => {
    expect(transactionType({ amount_cents: -100, is_transfer: true })).toBe(
      'transfer'
    )
  })
  it('positive (and zero-guarded) is income, negative is expense', () => {
    expect(transactionType({ amount_cents: 100, is_transfer: false })).toBe(
      'income'
    )
    expect(transactionType({ amount_cents: -100, is_transfer: false })).toBe(
      'expense'
    )
  })
})
