import { describe, expect, it } from 'vitest'
import {
  clampPeriod,
  currentPeriod,
  dayBeforeIso,
  earliestIso,
  monthRangeIso,
  parseEarningsPeriod,
  parseEarningsView,
  periodEndIso,
  periodRangeIso,
  shiftPeriod,
  trailingYearStartIso,
  yearRangeIso,
} from './earnings-period'

describe('dayBeforeIso', () => {
  it('subtracts one day, crossing a month boundary', () => {
    expect(dayBeforeIso('2026-07-01')).toBe('2026-06-30')
  })
})

describe('monthRangeIso', () => {
  it('returns the month start and the next month start', () => {
    expect(monthRangeIso('2026-02')).toEqual({
      start: '2026-02-01',
      endExclusive: '2026-03-01',
    })
  })
})

describe('yearRangeIso', () => {
  it('returns the year start and the next year start', () => {
    expect(yearRangeIso('2025')).toEqual({
      start: '2025-01-01',
      endExclusive: '2026-01-01',
    })
  })
})

describe('periodRangeIso', () => {
  it('delegates to monthRangeIso for month view', () => {
    expect(periodRangeIso('month', '2026-02')).toEqual(monthRangeIso('2026-02'))
  })

  it('delegates to yearRangeIso for year view', () => {
    expect(periodRangeIso('year', '2025')).toEqual(yearRangeIso('2025'))
  })
})

describe('periodEndIso', () => {
  it('returns the inclusive month end when fully in the past', () => {
    expect(periodEndIso('month', '2026-02', '2026-07-23')).toBe('2026-02-28')
  })

  it('clips the current month to today', () => {
    expect(periodEndIso('month', '2026-07', '2026-07-23')).toBe('2026-07-23')
  })

  it('clips the current year to today', () => {
    expect(periodEndIso('year', '2026', '2026-07-23')).toBe('2026-07-23')
  })

  it('returns the inclusive year end when fully in the past', () => {
    expect(periodEndIso('year', '2025', '2026-07-23')).toBe('2025-12-31')
  })
})

describe('trailingYearStartIso', () => {
  it('returns the day after one year before asOf', () => {
    expect(trailingYearStartIso('2026-07-23')).toBe('2025-07-24')
  })
})

describe('shiftPeriod', () => {
  it('shifts a month forward within the same year', () => {
    expect(shiftPeriod('month', '2026-06', 1)).toBe('2026-07')
  })

  it('shifts a month backward across a year boundary', () => {
    expect(shiftPeriod('month', '2026-01', -1)).toBe('2025-12')
  })

  it('shifts a month forward across a year boundary', () => {
    expect(shiftPeriod('month', '2025-12', 1)).toBe('2026-01')
  })

  it('shifts a year', () => {
    expect(shiftPeriod('year', '2026', -1)).toBe('2025')
  })
})

describe('currentPeriod', () => {
  it('returns YYYY-MM for month view', () => {
    expect(currentPeriod('month', '2026-07-23')).toBe('2026-07')
  })

  it('returns YYYY for year view', () => {
    expect(currentPeriod('year', '2026-07-23')).toBe('2026')
  })
})

describe('parseEarningsView', () => {
  it('accepts "year"', () => {
    expect(parseEarningsView('year')).toBe('year')
  })

  it('defaults to "month" for anything else', () => {
    expect(parseEarningsView('bogus')).toBe('month')
    expect(parseEarningsView(undefined)).toBe('month')
  })
})

describe('parseEarningsPeriod', () => {
  it('accepts a well-formed month', () => {
    expect(parseEarningsPeriod('2026-03', 'month', '2026-07-23')).toBe(
      '2026-03'
    )
  })

  it('accepts a well-formed year', () => {
    expect(parseEarningsPeriod('2025', 'year', '2026-07-23')).toBe('2025')
  })

  it('falls back to the current period when missing', () => {
    expect(parseEarningsPeriod(undefined, 'month', '2026-07-23')).toBe(
      '2026-07'
    )
  })

  it('falls back to the current period when malformed', () => {
    expect(parseEarningsPeriod('not-a-month', 'month', '2026-07-23')).toBe(
      '2026-07'
    )
    expect(parseEarningsPeriod('2026-03', 'year', '2026-07-23')).toBe('2026')
  })
})

describe('clampPeriod', () => {
  it('passes through a period within bounds', () => {
    expect(clampPeriod('2026-03', '2024-01', '2026-07')).toBe('2026-03')
  })

  it('clamps below the earliest bound', () => {
    expect(clampPeriod('2020-01', '2024-01', '2026-07')).toBe('2024-01')
  })

  it('clamps above the latest bound', () => {
    expect(clampPeriod('2030-01', '2024-01', '2026-07')).toBe('2026-07')
  })
})

describe('earliestIso', () => {
  it('returns null for an empty list', () => {
    expect(earliestIso([])).toBeNull()
  })

  it('returns the lexically (and chronologically) smallest date', () => {
    expect(earliestIso(['2026-03-01', '2024-06-15', '2025-01-01'])).toBe(
      '2024-06-15'
    )
  })
})
