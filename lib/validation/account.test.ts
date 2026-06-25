import { describe, expect, it } from 'vitest'
import {
  accountRowSchema,
  accountTypeSchema,
  createAccountSchema,
  currencySchema,
  openingBalanceSchema,
  parseOpeningBalanceToCents,
} from '@/lib/validation/account'

describe('accountTypeSchema', () => {
  it('accepts the five known types', () => {
    for (const t of [
      'checking',
      'savings',
      'cash',
      'credit_card',
      'investment',
    ]) {
      expect(accountTypeSchema.safeParse(t).success).toBe(true)
    }
  })

  it('rejects unknown types', () => {
    expect(accountTypeSchema.safeParse('crypto').success).toBe(false)
    expect(accountTypeSchema.safeParse('').success).toBe(false)
  })
})

describe('currencySchema', () => {
  it('accepts 3-letter uppercase codes', () => {
    expect(currencySchema.safeParse('EUR').success).toBe(true)
    expect(currencySchema.safeParse('USD').success).toBe(true)
  })

  it('rejects malformed codes', () => {
    for (const bad of ['eur', 'EU', 'EURO', '123', '']) {
      expect(currencySchema.safeParse(bad).success).toBe(false)
    }
  })
})

describe('openingBalanceSchema', () => {
  it('defaults missing input to "0"', () => {
    expect(openingBalanceSchema.parse(undefined)).toBe('0')
  })

  it('accepts well-formed decimals and negatives', () => {
    for (const ok of ['0', '1234.56', '-50', '10', '-0.99']) {
      expect(openingBalanceSchema.safeParse(ok).success).toBe(true)
    }
  })

  it('rejects malformed amounts', () => {
    for (const bad of ['1,234.56', 'abc', '1.2.3', '$10', '']) {
      expect(openingBalanceSchema.safeParse(bad).success).toBe(false)
    }
  })
})

describe('createAccountSchema', () => {
  it('trims the name and accepts a valid payload', () => {
    const parsed = createAccountSchema.parse({
      name: '  Checking  ',
      type: 'checking',
      currency: 'EUR',
      openingBalance: '100.00',
    })
    expect(parsed.name).toBe('Checking')
  })

  it('rejects an empty (whitespace-only) name', () => {
    expect(
      createAccountSchema.safeParse({
        name: '   ',
        type: 'checking',
        currency: 'EUR',
        openingBalance: '0',
      }).success
    ).toBe(false)
  })

  it('rejects a name longer than 100 chars', () => {
    expect(
      createAccountSchema.safeParse({
        name: 'x'.repeat(101),
        type: 'checking',
        currency: 'EUR',
        openingBalance: '0',
      }).success
    ).toBe(false)
  })
})

describe('parseOpeningBalanceToCents', () => {
  it('converts decimal strings to integer cents without float drift', () => {
    expect(parseOpeningBalanceToCents('1234.56', 'EUR')).toBe(123456)
    expect(parseOpeningBalanceToCents('0', 'EUR')).toBe(0)
    expect(parseOpeningBalanceToCents('-50', 'EUR')).toBe(-5000)
    expect(parseOpeningBalanceToCents('1.005', 'EUR')).toBe(101)
  })
})

describe('accountRowSchema', () => {
  const base = {
    id: '00000000-0000-0000-0000-00000000000a',
    user_id: '00000000-0000-0000-0000-00000000000b',
    name: 'Checking',
    type: 'checking',
    currency: 'EUR',
    opening_balance: 123456,
    archived: false,
    created_at: '2026-06-22T00:00:00.000Z',
    updated_at: '2026-06-22T00:00:00.000Z',
  }

  it('parses a valid row', () => {
    expect(accountRowSchema.parse(base).opening_balance).toBe(123456)
  })

  it('coerces a string opening_balance to a number', () => {
    const parsed = accountRowSchema.parse({ ...base, opening_balance: '789' })
    expect(parsed.opening_balance).toBe(789)
  })

  it('rejects an unknown type', () => {
    expect(
      accountRowSchema.safeParse({ ...base, type: 'crypto' }).success
    ).toBe(false)
  })
})
