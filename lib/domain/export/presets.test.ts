import { describe, expect, it } from 'vitest'
import { presetRange } from './presets'

// Fixed "today": July 3, 2026 (month index 6), local time.
const TODAY = new Date(2026, 6, 3)

describe('presetRange', () => {
  it('all time has no bounds', () => {
    expect(presetRange('all', TODAY)).toEqual({ from: null, to: null })
  })

  it('this month starts on the 1st of the current month', () => {
    expect(presetRange('month', TODAY)).toEqual({
      from: '2026-07-01',
      to: '2026-07-03',
    })
  })

  it('last 3 months spans three calendar months including the current', () => {
    expect(presetRange('quarter', TODAY)).toEqual({
      from: '2026-05-01',
      to: '2026-07-03',
    })
  })

  it('last 3 months rolls over a year boundary', () => {
    expect(presetRange('quarter', new Date(2026, 0, 15))).toEqual({
      from: '2025-11-01',
      to: '2026-01-15',
    })
  })

  it('this year starts on January 1st', () => {
    expect(presetRange('year', TODAY)).toEqual({
      from: '2026-01-01',
      to: '2026-07-03',
    })
  })
})
