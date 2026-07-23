import { describe, expect, it } from 'vitest'
import { isEarningCategory } from './earnings'

describe('isEarningCategory', () => {
  it('excludes uncategorized transactions', () => {
    expect(isEarningCategory(null, undefined)).toBe(false)
  })

  it('excludes bizum_income', () => {
    expect(isEarningCategory('cat-1', 'bizum_income')).toBe(false)
  })

  it('excludes transactions_income', () => {
    expect(isEarningCategory('cat-1', 'transactions_income')).toBe(false)
  })

  it('includes salary', () => {
    expect(isEarningCategory('cat-1', 'salary')).toBe(true)
  })

  it('includes a custom user category (null name_key, but a real category_id)', () => {
    expect(isEarningCategory('cat-1', null)).toBe(true)
  })
})
