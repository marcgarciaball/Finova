import { describe, expect, it } from 'vitest'
import { filterByPeriod, parsePeriod, periodStartIso } from './period'

describe('parsePeriod', () => {
  it('accepts the known periods', () => {
    expect(parsePeriod('30d')).toBe('30d')
    expect(parsePeriod('ytd')).toBe('ytd')
    expect(parsePeriod('all')).toBe('all')
  })

  it('defaults to 90d for missing/unknown input', () => {
    expect(parsePeriod(undefined)).toBe('90d')
    expect(parsePeriod('')).toBe('90d')
    expect(parsePeriod('bogus')).toBe('90d')
  })
})

describe('periodStartIso', () => {
  const today = '2026-06-28'

  it('computes day-based starts (inclusive lower bound)', () => {
    expect(periodStartIso('30d', today)).toBe('2026-05-29')
    expect(periodStartIso('90d', today)).toBe('2026-03-30')
  })

  it('computes a 12-month start', () => {
    expect(periodStartIso('12m', today)).toBe('2025-06-28')
  })

  it('uses Jan 1 of the current year for ytd', () => {
    expect(periodStartIso('ytd', today)).toBe('2026-01-01')
  })

  it('returns null for all (no lower bound)', () => {
    expect(periodStartIso('all', today)).toBeNull()
  })
})

describe('filterByPeriod', () => {
  const today = '2026-06-28'
  const rows = [
    { occurred_at: '2026-06-20T10:00:00Z' }, // within 30d
    { occurred_at: '2026-04-01T00:00:00Z' }, // within 90d, outside 30d
    { occurred_at: '2025-01-01T00:00:00Z' }, // outside 12m
  ]

  it('keeps only rows on/after the period start', () => {
    expect(filterByPeriod(rows, '30d', today)).toEqual([rows[0]])
    expect(filterByPeriod(rows, '90d', today)).toEqual([rows[0], rows[1]])
  })

  it('includes a row exactly on the start date', () => {
    const start = periodStartIso('30d', today) as string
    const onBoundary = [{ occurred_at: `${start}T08:00:00Z` }]
    expect(filterByPeriod(onBoundary, '30d', today)).toEqual(onBoundary)
  })

  it('returns all rows unchanged for all', () => {
    expect(filterByPeriod(rows, 'all', today)).toEqual(rows)
  })
})
