import { describe, expect, it } from 'vitest'
import {
  createInvestmentTransactionSchema,
  parseAmountToCents,
} from './investment-transaction'

const valid = {
  assetId: '11111111-1111-4111-8111-111111111111',
  currency: 'USD',
  fees: '1.50',
  notes: 'first buy',
  price: '190.55',
  quantity: '0.5',
  tradedAt: '2026-01-02',
  type: 'buy',
}

describe('createInvestmentTransactionSchema', () => {
  it('accepts a valid buy', () => {
    const p = createInvestmentTransactionSchema.parse(valid)
    expect(p.quantity).toBe('0.5')
    expect(p.type).toBe('buy')
  })

  it('defaults fees to 0 and empties blank notes', () => {
    const p = createInvestmentTransactionSchema.parse({
      ...valid,
      fees: undefined,
      notes: '',
    })
    expect(p.fees).toBe('0')
    expect(p.notes).toBeUndefined()
  })

  it('defaults funding source to own_funds', () => {
    const p = createInvestmentTransactionSchema.parse(valid)
    expect(p.fundingSource).toBe('own_funds')
    expect(p.fundingNote).toBeUndefined()
  })

  it('accepts a credit-funded buy with a note', () => {
    const p = createInvestmentTransactionSchema.parse({
      ...valid,
      fundingNote: 'broker margin',
      fundingSource: 'credit',
    })
    expect(p.fundingSource).toBe('credit')
    expect(p.fundingNote).toBe('broker margin')
  })

  it('clears the funding source and note on a sell', () => {
    const p = createInvestmentTransactionSchema.parse({
      ...valid,
      fundingNote: 'broker margin',
      fundingSource: 'credit',
      type: 'sell',
    })
    expect(p.fundingSource).toBe('own_funds')
    expect(p.fundingNote).toBeUndefined()
  })

  const reject = (over: Record<string, unknown>, msg: string) => {
    const r = createInvestmentTransactionSchema.safeParse({
      ...valid,
      ...over,
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe(msg)
    }
  }

  it('rejects a zero quantity', () => {
    reject({ quantity: '0' }, 'mustBePositive')
  })
  it('rejects more than 8 decimal places', () => {
    reject({ quantity: '0.000000001' }, 'tooManyDecimals')
  })
  it('rejects a negative price', () => {
    reject({ price: '-5' }, 'invalidAmount')
  })
  it('rejects a future trade date', () => {
    reject({ tradedAt: '2999-01-01' }, 'futureDate')
  })
  it('rejects a malformed date', () => {
    reject({ tradedAt: '01/02/2026' }, 'invalidDate')
  })
  it('rejects a bad currency', () => {
    reject({ currency: 'usd' }, 'invalidCurrency')
  })
  it('rejects an unknown type', () => {
    expect(
      createInvestmentTransactionSchema.safeParse({ ...valid, type: 'short' })
        .success
    ).toBe(false)
  })
})

describe('parseAmountToCents', () => {
  it('converts major units to integer cents', () => {
    expect(parseAmountToCents('190.55', 'USD')).toBe(19055)
    expect(parseAmountToCents('0', 'EUR')).toBe(0)
  })
})
