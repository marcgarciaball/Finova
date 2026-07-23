import { describe, expect, it } from '@jest/globals'
import { isSessionValid } from './session'

describe('isSessionValid', () => {
  it('returns false for null', () => {
    expect(isSessionValid(null)).toBe(false)
  })

  it('returns false for an expired session', () => {
    const expired = { expires_at: Math.floor(Date.now() / 1000) - 60 } as never
    expect(isSessionValid(expired)).toBe(false)
  })

  it('returns true for a session expiring in the future', () => {
    const valid = { expires_at: Math.floor(Date.now() / 1000) + 3600 } as never
    expect(isSessionValid(valid)).toBe(true)
  })
})
