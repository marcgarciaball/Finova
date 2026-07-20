import { describe, expect, it } from 'vitest'
import { format } from './format'
import { money, zero } from './money'

// Use non-breaking-space-insensitive matching: Intl inserts NBSP/narrow-NBSP.
const normalize = (s: string) => s.replace(/ | /g, ' ')

describe('format', () => {
  it('formats EUR in es with comma decimals and locale grouping', () => {
    expect(normalize(format(money(123456, 'EUR'), 'es'))).toMatch(
      /^1\.?234,56 €$/
    )
  })

  it('formats USD in en with dot decimals and comma grouping', () => {
    expect(normalize(format(money(123456, 'USD'), 'en'))).toMatch(
      /^\$1,?234\.56$/
    )
  })

  it('always shows exactly two fraction digits', () => {
    expect(normalize(format(money(100, 'EUR'), 'en'))).toBe('€1.00')
    expect(normalize(format(money(5, 'EUR'), 'en'))).toBe('€0.05')
  })

  it('formats negative and zero amounts', () => {
    expect(normalize(format(money(-100, 'USD'), 'en'))).toBe('-$1.00')
    expect(normalize(format(zero('EUR'), 'en'))).toBe('€0.00')
  })
})
