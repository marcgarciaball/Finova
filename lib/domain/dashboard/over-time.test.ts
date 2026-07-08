import { describe, expect, it } from 'vitest'
import {
  balanceTrend,
  incomeExpenseSeries,
  monthlySeries,
  parseGranularity,
  type TimedTxn,
} from './over-time'

const t = (
  occurred_at: string,
  amount_cents: number,
  currency = 'EUR',
  is_transfer = false
): TimedTxn => ({ occurred_at, amount_cents, currency, is_transfer })

describe('monthlySeries', () => {
  it('buckets by YYYY-MM and splits income/expense by sign', () => {
    const out = monthlySeries([
      t('2026-01-05T00:00:00Z', 5_000),
      t('2026-01-20T00:00:00Z', -2_000),
      t('2026-02-01T00:00:00Z', -1_000),
    ])
    expect(out.EUR).toEqual([
      { period: '2026-01', income: 5_000, expense: 2_000, net: 3_000 },
      { period: '2026-02', income: 0, expense: 1_000, net: -1_000 },
    ])
  })

  it('excludes transfers', () => {
    const out = monthlySeries([
      t('2026-01-05T00:00:00Z', -2_000),
      t('2026-01-06T00:00:00Z', -9_999, 'EUR', true),
    ])
    expect(out.EUR?.[0]?.expense).toBe(2_000)
  })

  it('keeps currencies separate', () => {
    const out = monthlySeries([
      t('2026-01-05T00:00:00Z', 1_000, 'EUR'),
      t('2026-01-05T00:00:00Z', 2_000, 'USD'),
    ])
    expect(out.EUR?.[0]?.income).toBe(1_000)
    expect(out.USD?.[0]?.income).toBe(2_000)
  })

  it('sorts buckets ascending by period', () => {
    const out = monthlySeries([
      t('2026-03-01T00:00:00Z', 100),
      t('2026-01-01T00:00:00Z', 100),
      t('2026-02-01T00:00:00Z', 100),
    ])
    expect((out.EUR ?? []).map((b) => b.period)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
    ])
  })

  it('returns an empty map for no rows', () => {
    expect(monthlySeries([])).toEqual({})
  })
})

describe('balanceTrend', () => {
  it('cumulates the signed amount across months', () => {
    const out = balanceTrend([
      t('2026-01-05T00:00:00Z', 5_000),
      t('2026-02-05T00:00:00Z', -2_000),
      t('2026-03-05T00:00:00Z', 1_000),
    ])
    expect(out.EUR).toEqual([
      { period: '2026-01', balance: 5_000 },
      { period: '2026-02', balance: 3_000 },
      { period: '2026-03', balance: 4_000 },
    ])
  })

  it('includes transfers in the running balance', () => {
    const out = balanceTrend([t('2026-01-05T00:00:00Z', -2_000, 'EUR', true)])
    expect(out.EUR?.[0]?.balance).toBe(-2_000)
  })

  it('starts from the per-currency opening baseline', () => {
    const out = balanceTrend([t('2026-01-05T00:00:00Z', 1_000)], {
      EUR: 10_000,
    })
    expect(out.EUR?.[0]?.balance).toBe(11_000)
  })

  it('final point equals opening + sum of all signed amounts (P4-01 parity)', () => {
    const txns = [
      t('2026-01-05T00:00:00Z', 5_000),
      t('2026-01-20T00:00:00Z', -2_000, 'EUR', true),
      t('2026-02-05T00:00:00Z', -1_000),
    ]
    const out = balanceTrend(txns, { EUR: 1_000 })
    const last = out.EUR?.at(-1)?.balance
    expect(last).toBe(1_000 + 5_000 - 2_000 - 1_000)
  })

  it('returns an empty map for no rows', () => {
    expect(balanceTrend([])).toEqual({})
  })
})

describe('incomeExpenseSeries', () => {
  it('buckets by day', () => {
    const out = incomeExpenseSeries(
      [
        t('2026-01-05T08:00:00Z', 5_000),
        t('2026-01-05T20:00:00Z', -2_000),
        t('2026-01-06T00:00:00Z', -1_000),
      ],
      'day'
    )
    expect(out.EUR).toEqual([
      { period: '2026-01-05', income: 5_000, expense: 2_000, net: 3_000 },
      { period: '2026-01-06', income: 0, expense: 1_000, net: -1_000 },
    ])
  })

  it('buckets by year', () => {
    const out = incomeExpenseSeries(
      [t('2025-12-31T00:00:00Z', 5_000), t('2026-01-01T00:00:00Z', -2_000)],
      'year'
    )
    expect(out.EUR).toEqual([
      { period: '2025', income: 5_000, expense: 0, net: 5_000 },
      { period: '2026', income: 0, expense: 2_000, net: -2_000 },
    ])
  })

  it('month granularity matches monthlySeries', () => {
    const txns = [
      t('2026-01-05T00:00:00Z', 5_000),
      t('2026-02-01T00:00:00Z', -1_000),
    ]
    expect(incomeExpenseSeries(txns, 'month')).toEqual(monthlySeries(txns))
  })
})

describe('parseGranularity', () => {
  it('accepts the three granularities and defaults to month', () => {
    expect(parseGranularity('day')).toBe('day')
    expect(parseGranularity('year')).toBe('year')
    expect(parseGranularity('bogus')).toBe('month')
    expect(parseGranularity(undefined)).toBe('month')
  })
})
