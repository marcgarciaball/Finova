import { describe, expect, it } from 'vitest'
import { pickDisplayCurrency } from './display-currency'

describe('pickDisplayCurrency', () => {
  it('prefers the base currency when it has any transaction', () => {
    const txns = [{ currency: 'USD' }, { currency: 'EUR' }, { currency: 'USD' }]
    expect(pickDisplayCurrency(txns, 'EUR')).toBe('EUR')
  })

  it('falls back to the modal currency when base is absent', () => {
    const txns = [{ currency: 'USD' }, { currency: 'USD' }, { currency: 'GBP' }]
    expect(pickDisplayCurrency(txns, 'EUR')).toBe('USD')
  })

  it('returns the base currency for an empty transaction set', () => {
    expect(pickDisplayCurrency([], 'EUR')).toBe('EUR')
  })

  it('tie-breaks deterministically by currency code', () => {
    const txns = [{ currency: 'USD' }, { currency: 'GBP' }]
    expect(pickDisplayCurrency(txns, 'EUR')).toBe('GBP')
  })
})
