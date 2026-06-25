import { describe, expect, it } from 'vitest'
import {
  amountSchema,
  createTransactionSchema,
  parseAmountToCents,
  tagsSchema,
  transactionRowSchema,
} from '@/lib/validation/transaction'

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111'
const CATEGORY_ID = '22222222-2222-4222-8222-222222222222'

describe('amountSchema', () => {
  it('accepts signed, well-formed decimals', () => {
    for (const ok of ['1234.56', '-50', '10', '-0.99', '0.01']) {
      expect(amountSchema.safeParse(ok).success).toBe(true)
    }
  })

  it('rejects zero and malformed amounts', () => {
    for (const bad of ['0', '0.00', '-0', '1,234.56', 'abc', '1.2.3', '']) {
      expect(amountSchema.safeParse(bad).success).toBe(false)
    }
  })
})

describe('tagsSchema', () => {
  it('defaults to an empty array', () => {
    expect(tagsSchema.parse(undefined)).toEqual([])
  })

  it('trims tags and rejects empty entries', () => {
    expect(tagsSchema.parse([' food ', 'travel'])).toEqual(['food', 'travel'])
    expect(tagsSchema.safeParse(['ok', '   ']).success).toBe(false)
  })
})

describe('createTransactionSchema', () => {
  const base = {
    accountId: ACCOUNT_ID,
    amount: '42.50',
    currency: 'EUR',
    occurredAt: '2026-06-22T10:00:00.000Z',
    description: '  Groceries  ',
  }

  it('parses a minimal valid payload (uncategorized, no note, no tags)', () => {
    const parsed = createTransactionSchema.parse(base)
    expect(parsed.description).toBe('Groceries')
    expect(parsed.categoryId).toBeNull()
    expect(parsed.note).toBeNull()
    expect(parsed.tags).toEqual([])
    expect(parsed.isRecurring).toBe(false)
    expect(parsed.occurredAt).toBeInstanceOf(Date)
  })

  it('accepts a category id and coerces empty strings to null', () => {
    expect(
      createTransactionSchema.parse({ ...base, categoryId: CATEGORY_ID })
        .categoryId
    ).toBe(CATEGORY_ID)
    expect(
      createTransactionSchema.parse({ ...base, categoryId: '' }).categoryId
    ).toBeNull()
    expect(createTransactionSchema.parse({ ...base, note: '' }).note).toBeNull()
  })

  it('rejects a non-uuid account id', () => {
    expect(
      createTransactionSchema.safeParse({ ...base, accountId: 'nope' }).success
    ).toBe(false)
  })

  it('rejects an empty or over-long description', () => {
    expect(
      createTransactionSchema.safeParse({ ...base, description: '   ' }).success
    ).toBe(false)
    expect(
      createTransactionSchema.safeParse({
        ...base,
        description: 'x'.repeat(201),
      }).success
    ).toBe(false)
  })

  it('rejects a zero amount', () => {
    expect(
      createTransactionSchema.safeParse({ ...base, amount: '0' }).success
    ).toBe(false)
  })
})

describe('parseAmountToCents', () => {
  it('converts signed decimal strings to integer cents without float drift', () => {
    expect(parseAmountToCents('1234.56', 'EUR')).toBe(123456)
    expect(parseAmountToCents('-50', 'EUR')).toBe(-5000)
    expect(parseAmountToCents('1.005', 'EUR')).toBe(101)
  })
})

describe('transactionRowSchema', () => {
  const base = {
    id: '00000000-0000-0000-0000-0000000000f1',
    user_id: '00000000-0000-0000-0000-0000000000f2',
    account_id: ACCOUNT_ID,
    category_id: CATEGORY_ID,
    amount_cents: -4250,
    currency: 'EUR',
    occurred_at: '2026-06-22T10:00:00.000Z',
    description: 'Groceries',
    note: null,
    tags: ['food'],
    is_transfer: false,
    transfer_group_id: null,
    is_recurring: false,
    created_at: '2026-06-22T00:00:00.000Z',
    updated_at: '2026-06-22T00:00:00.000Z',
  }

  it('parses a valid row', () => {
    const parsed = transactionRowSchema.parse(base)
    expect(parsed.amount_cents).toBe(-4250)
    expect(parsed.tags).toEqual(['food'])
  })

  it('coerces a string amount_cents to a number', () => {
    expect(
      transactionRowSchema.parse({ ...base, amount_cents: '789' }).amount_cents
    ).toBe(789)
  })

  it('accepts a null category and a transfer group id', () => {
    expect(
      transactionRowSchema.safeParse({
        ...base,
        category_id: null,
        is_transfer: true,
        transfer_group_id: '00000000-0000-0000-0000-0000000000a9',
      }).success
    ).toBe(true)
  })

  it('rejects a malformed currency', () => {
    expect(
      transactionRowSchema.safeParse({ ...base, currency: 'eur' }).success
    ).toBe(false)
  })
})
