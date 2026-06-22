import { describe, expect, it } from 'vitest'
import { clientEnvSchema, parseEnv } from '@/lib/validation/env'

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnop',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
}

describe('parseEnv', () => {
  it('returns typed data for a valid source', () => {
    const env = parseEnv(clientEnvSchema, valid, 'client')
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://abc.supabase.co')
  })

  it('applies the default site URL when omitted', () => {
    const { NEXT_PUBLIC_SITE_URL: _omit, ...rest } = valid
    const env = parseEnv(clientEnvSchema, rest, 'client')
    expect(env.NEXT_PUBLIC_SITE_URL).toBe('http://localhost:3000')
  })

  it('rejects a bare ref that is not a URL (the real-world bug)', () => {
    expect(() =>
      parseEnv(
        clientEnvSchema,
        { ...valid, NEXT_PUBLIC_SUPABASE_URL: 'uivuuymiqxlokjqizvpg' },
        'client'
      )
    ).toThrowError(/NEXT_PUBLIC_SUPABASE_URL: must be a full URL/)
  })

  it('rejects a missing key', () => {
    const { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: _omit, ...rest } = valid
    expect(() => parseEnv(clientEnvSchema, rest, 'client')).toThrowError(
      /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/
    )
  })

  it('rejects a too-short key', () => {
    expect(() =>
      parseEnv(
        clientEnvSchema,
        { ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'short' },
        'client'
      )
    ).toThrowError(/too short/)
  })

  it('lists every problem at once and names the scope', () => {
    try {
      parseEnv(
        clientEnvSchema,
        {
          NEXT_PUBLIC_SUPABASE_URL: 'nope',
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'x',
        },
        'client'
      )
      expect.unreachable('should have thrown')
    } catch (err) {
      const message = (err as Error).message
      expect(message).toContain('Invalid client environment variables')
      expect(message).toContain('NEXT_PUBLIC_SUPABASE_URL')
      expect(message).toContain('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
      expect(message).toContain('.env.local')
    }
  })
})
