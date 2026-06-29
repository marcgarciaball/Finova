import { describe, expect, it } from 'vitest'
import type { CategorySpend } from './by-category'
import {
  balanceTrendToArea,
  monthlySeriesToBars,
  spendingToDonut,
} from './chart-data'
import type { MonthBucket, TrendPoint } from './over-time'

describe('monthlySeriesToBars', () => {
  it('converts cents to major units, keeps period as the index', () => {
    const buckets: MonthBucket[] = [
      { period: '2026-05', income: 200_000, expense: 75_050, net: 124_950 },
      { period: '2026-06', income: 150_000, expense: 90_000, net: 60_000 },
    ]
    expect(monthlySeriesToBars(buckets)).toEqual({
      index: 'period',
      categories: ['income', 'expense'],
      data: [
        { period: '2026-05', income: 2000, expense: 750.5 },
        { period: '2026-06', income: 1500, expense: 900 },
      ],
    })
  })

  it('returns empty data for no buckets', () => {
    expect(monthlySeriesToBars([]).data).toEqual([])
  })
})

describe('balanceTrendToArea', () => {
  it('converts cumulative balances to major units', () => {
    const points: TrendPoint[] = [
      { period: '2026-05', balance: 100_000 },
      { period: '2026-06', balance: 160_000 },
    ]
    expect(balanceTrendToArea(points)).toEqual({
      index: 'period',
      categories: ['balance'],
      data: [
        { period: '2026-05', balance: 1000 },
        { period: '2026-06', balance: 1600 },
      ],
    })
  })
})

describe('spendingToDonut', () => {
  const label = (id: string | null) => (id === null ? 'Uncategorized' : id)

  it('maps category spend to name/value slices in major units, order preserved', () => {
    const spend: CategorySpend[] = [
      { categoryId: 'groceries', total: 50_000, count: 4, share: 0.5 },
      { categoryId: null, total: 25_000, count: 2, share: 0.25 },
    ]
    expect(spendingToDonut(spend, label)).toEqual([
      { name: 'groceries', value: 500 },
      { name: 'Uncategorized', value: 250 },
    ])
  })

  it('returns empty slices for no spend', () => {
    expect(spendingToDonut([], label)).toEqual([])
  })
})
