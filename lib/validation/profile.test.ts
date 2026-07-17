import { describe, expect, it } from 'vitest'
import {
  emailConfirmationMatches,
  updateProfileSchema,
} from '@/lib/validation/profile'

describe('updateProfileSchema', () => {
  it('accepts valid ISO-4217 codes and upper-cases them', () => {
    const r = updateProfileSchema.parse({
      baseCurrency: 'eur',
      displayCurrency: 'usd',
    })
    expect(r).toEqual({ baseCurrency: 'EUR', displayCurrency: 'USD' })
  })

  it('rejects a non-3-letter code', () => {
    expect(
      updateProfileSchema.safeParse({
        baseCurrency: 'EU',
        displayCurrency: 'USD',
      }).success
    ).toBe(false)
  })

  it('rejects codes with digits', () => {
    expect(
      updateProfileSchema.safeParse({
        baseCurrency: 'EU1',
        displayCurrency: 'USD',
      }).success
    ).toBe(false)
  })
})

describe('emailConfirmationMatches', () => {
  it('matches the exact email', () => {
    expect(emailConfirmationMatches('marc@x.com', 'marc@x.com')).toBe(true)
  })

  it('is trim + case-insensitive', () => {
    expect(emailConfirmationMatches('  MARC@X.com ', 'marc@x.com')).toBe(true)
  })

  it('rejects a different address', () => {
    expect(emailConfirmationMatches('other@x.com', 'marc@x.com')).toBe(false)
  })

  it('rejects when either side is empty', () => {
    expect(emailConfirmationMatches('', 'marc@x.com')).toBe(false)
    expect(emailConfirmationMatches('marc@x.com', '')).toBe(false)
  })
})
