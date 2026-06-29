import { describe, expect, it } from 'vitest'
import { keyStats, type StatTxn } from './key-stats'

const t = (
  occurred_at: string,
  amount_cents: number,
  currency = 'EUR',
  is_transfer = false,
  description = 'tx'
): StatTxn => ({
  occurred_at,
  amount_cents,
  currency,
  is_transfer,
  description,
})

describe('keyStats', () => {
  it('counts non-transfer transactions per currency', () => {
    const out = keyStats([
      t('2026-01-01T00:00:00Z', -100),
      t('2026-01-02T00:00:00Z', 5_000),
      t('2026-01-03T00:00:00Z', -200, 'EUR', true), // transfer excluded
    ])
    expect(out.EUR?.count).toBe(2)
  })

  it('averages expense magnitude (rounded to whole cents), ignoring income and transfers', () => {
    const out = keyStats([
      t('2026-01-01T00:00:00Z', -2_000),
      t('2026-01-02T00:00:00Z', -1_000),
      t('2026-01-03T00:00:00Z', 9_999), // income ignored
      t('2026-01-04T00:00:00Z', -5_000, 'EUR', true), // transfer ignored
    ])
    expect(out.EUR?.averageSpend).toBe(1_500)
  })

  it('reports null averageSpend when there is no expense', () => {
    const out = keyStats([t('2026-01-01T00:00:00Z', 5_000)])
    expect(out.EUR?.averageSpend).toBeNull()
  })

  it('finds the single biggest expense with its description and date', () => {
    const out = keyStats([
      t('2026-01-01T00:00:00Z', -2_000, 'EUR', false, 'small'),
      t('2026-01-02T00:00:00Z', -9_000, 'EUR', false, 'rent'),
      t('2026-01-03T00:00:00Z', -1_000, 'EUR', false, 'coffee'),
    ])
    expect(out.EUR?.biggestExpense).toEqual({
      amountCents: 9_000,
      description: 'rent',
      occurredAt: '2026-01-02T00:00:00Z',
    })
  })

  it('finds the busiest day by non-transfer transaction count, earliest on ties', () => {
    const out = keyStats([
      t('2026-01-01T00:00:00Z', -100),
      t('2026-01-01T09:00:00Z', -200),
      t('2026-01-02T00:00:00Z', -300),
      t('2026-01-02T09:00:00Z', -400), // 01-02 also has 2 → tie, earliest wins
    ])
    expect(out.EUR?.busiestDay).toEqual({ day: '2026-01-01', count: 2 })
  })

  it('keeps currencies separate', () => {
    const out = keyStats([
      t('2026-01-01T00:00:00Z', -1_000, 'EUR'),
      t('2026-01-01T00:00:00Z', -2_000, 'USD'),
    ])
    expect(out.EUR?.count).toBe(1)
    expect(out.USD?.biggestExpense?.amountCents).toBe(2_000)
  })

  it('returns an empty record for no input', () => {
    expect(keyStats([])).toEqual({})
  })
})
