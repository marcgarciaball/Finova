import { describe, expect, it } from 'vitest'
import {
  pctChange,
  previousPeriodRange,
  previousPeriodTxns,
  trendOf,
} from './compare'

const TODAY = '2026-06-29'

describe('previousPeriodRange', () => {
  it('returns the equal-length window immediately before a 30d period', () => {
    // current 30d window starts 2026-05-30; prior window is the 30 days before that.
    expect(previousPeriodRange('30d', TODAY)).toEqual({
      startIso: '2026-04-30',
      endExclusiveIso: '2026-05-30',
    })
  })

  it('returns null for the all-time period (no prior window)', () => {
    expect(previousPeriodRange('all', TODAY)).toBeNull()
  })

  it('uses days-since-Jan-1 as the length for ytd', () => {
    // ytd start = 2026-01-01; length = 179 days to 2026-06-29; prior window
    // is the 179 days before 2026-01-01.
    expect(previousPeriodRange('ytd', TODAY)).toEqual({
      startIso: '2025-07-06',
      endExclusiveIso: '2026-01-01',
    })
  })
})

describe('previousPeriodTxns', () => {
  const rows = [
    { occurred_at: '2026-06-10T00:00:00Z', id: 'now' }, // in current 30d
    { occurred_at: '2026-05-10T00:00:00Z', id: 'prev' }, // in prior 30d
    { occurred_at: '2026-03-01T00:00:00Z', id: 'old' }, // before prior window
  ]

  it('keeps only rows inside the prior window [start, endExclusive)', () => {
    const out = previousPeriodTxns(rows, '30d', TODAY)
    expect(out.map((r) => r.id)).toEqual(['prev'])
  })

  it('returns [] for the all-time period', () => {
    expect(previousPeriodTxns(rows, 'all', TODAY)).toEqual([])
  })
})

describe('pctChange', () => {
  it('returns the rounded percentage change', () => {
    expect(pctChange(110, 100)).toBe(10)
    expect(pctChange(80, 100)).toBe(-20)
  })

  it('returns null when the baseline is non-positive (undefined change)', () => {
    expect(pctChange(50, 0)).toBeNull()
    expect(pctChange(50, -10)).toBeNull()
  })
})

describe('trendOf', () => {
  it('classifies up / down / flat', () => {
    expect(trendOf(10, 5)).toBe('up')
    expect(trendOf(5, 10)).toBe('down')
    expect(trendOf(5, 5)).toBe('flat')
    expect(trendOf(0, 0)).toBe('flat')
  })
})
