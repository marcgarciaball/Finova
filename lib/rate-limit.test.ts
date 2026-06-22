import { describe, expect, it } from 'vitest'
import { createRateLimiter } from '@/lib/rate-limit'

describe('createRateLimiter', () => {
  it('allows up to the limit, then blocks within the window', () => {
    const check = createRateLimiter({ limit: 3, windowMs: 1000 })
    expect(check('ip', 0).success).toBe(true) // 1
    expect(check('ip', 100).success).toBe(true) // 2
    expect(check('ip', 200).success).toBe(true) // 3
    const blocked = check('ip', 300)
    expect(blocked.success).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  it('reports remaining correctly', () => {
    const check = createRateLimiter({ limit: 2, windowMs: 1000 })
    expect(check('ip', 0).remaining).toBe(1)
    expect(check('ip', 0).remaining).toBe(0)
  })

  it('resets after the window elapses', () => {
    const check = createRateLimiter({ limit: 1, windowMs: 1000 })
    expect(check('ip', 0).success).toBe(true)
    expect(check('ip', 500).success).toBe(false)
    expect(check('ip', 1000).success).toBe(true) // window rolled over
  })

  it('tracks keys independently', () => {
    const check = createRateLimiter({ limit: 1, windowMs: 1000 })
    expect(check('a', 0).success).toBe(true)
    expect(check('b', 0).success).toBe(true)
    expect(check('a', 0).success).toBe(false)
  })
})
