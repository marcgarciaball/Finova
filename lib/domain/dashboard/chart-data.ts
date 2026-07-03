/**
 * Chart adapters (P4-02/03). Pure glue mapping the per-currency dashboard cores
 * to the `components/charts` recharts shapes. recharts works in plain numbers,
 * so amounts are converted from integer cents to **major units** here (÷100);
 * exact, locale-aware currency text stays in the KPI tiles / tables via the
 * money module. Category labels are resolved by the caller (i18n-free core).
 */
import type { CategorySpend } from './by-category'
import type { MonthBucket, TrendPoint } from './over-time'

const toMajor = (cents: number): number => cents / 100

export interface BarSeries {
  categories: ['income', 'expense']
  data: Record<string, number | string>[]
  index: 'period'
}

export function monthlySeriesToBars(buckets: MonthBucket[]): BarSeries {
  return {
    index: 'period',
    categories: ['income', 'expense'],
    data: buckets.map((b) => ({
      period: b.period,
      income: toMajor(b.income),
      expense: toMajor(b.expense),
    })),
  }
}

export interface AreaSeries {
  categories: ['balance']
  data: Record<string, number | string>[]
  index: 'period'
}

export function balanceTrendToArea(points: TrendPoint[]): AreaSeries {
  return {
    index: 'period',
    categories: ['balance'],
    data: points.map((p) => ({
      period: p.period,
      balance: toMajor(p.balance),
    })),
  }
}

export function spendingToDonut(
  spend: CategorySpend[],
  label: (categoryId: string | null) => string,
  color?: (categoryId: string | null) => string | undefined
): { name: string; value: number; color?: string }[] {
  return spend.map((s) => {
    const c = color?.(s.categoryId)
    return {
      name: label(s.categoryId),
      value: toMajor(s.total),
      ...(c ? { color: c } : {}),
    }
  })
}
