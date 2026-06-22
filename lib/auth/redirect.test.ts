import { describe, expect, it } from 'vitest'
import { DEFAULT_REDIRECT, safeRedirectPath } from '@/lib/auth/redirect'

describe('safeRedirectPath', () => {
  it('allows a normal internal path', () => {
    expect(safeRedirectPath('/dashboard')).toBe('/dashboard')
  })

  it('preserves query and hash on internal paths', () => {
    expect(safeRedirectPath('/import?step=2#review')).toBe(
      '/import?step=2#review'
    )
  })

  const unsafe: Array<string | null | undefined> = [
    'https://evil.com',
    'http://evil.com/path',
    '//evil.com',
    '/\\evil.com',
    'javascript:alert(1)',
    'mailto:a@b.c',
    'evil.com',
    '',
    null,
    undefined,
  ]
  for (const input of unsafe) {
    it(`falls back for ${JSON.stringify(input)}`, () => {
      expect(safeRedirectPath(input)).toBe(DEFAULT_REDIRECT)
    })
  }

  it('honours a custom fallback', () => {
    expect(safeRedirectPath('https://evil.com', '/')).toBe('/')
  })
})
