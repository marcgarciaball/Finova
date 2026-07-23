import { describe, expect, it } from 'vitest'
import { hasMore } from './pagination'

describe('hasMore', () => {
  it('is true only when total exceeds the loaded count', () => {
    expect(hasMore(50, 50)).toBe(false)
    expect(hasMore(49, 50)).toBe(false)
    expect(hasMore(51, 50)).toBe(true)
    expect(hasMore(120, 50)).toBe(true)
  })
})
