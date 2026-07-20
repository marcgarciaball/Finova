import { describe, expect, it } from 'vitest'
import { parseDateToIso, parseDecimalToCanonical } from './locale-parse'

describe('parseDecimalToCanonical', () => {
  describe('with an explicit decimal hint', () => {
    it('parses es-style (decimal comma, dot grouping)', () => {
      expect(parseDecimalToCanonical('1.234,56', { decimal: ',' })).toBe(
        '1234.56'
      )
    })
    it('parses en-style (decimal dot, comma grouping)', () => {
      expect(parseDecimalToCanonical('1,234.56', { decimal: '.' })).toBe(
        '1234.56'
      )
    })
    it('parses a plain value with the hinted decimal', () => {
      expect(parseDecimalToCanonical('1234,5', { decimal: ',' })).toBe('1234.5')
    })
  })

  describe('auto-detection with both separators', () => {
    it('treats the rightmost separator as the decimal point', () => {
      expect(parseDecimalToCanonical('1.234,56')).toBe('1234.56')
      expect(parseDecimalToCanonical('1,234.56')).toBe('1234.56')
    })
    it('handles multiple grouping separators', () => {
      expect(parseDecimalToCanonical('1.234.567,89')).toBe('1234567.89')
      expect(parseDecimalToCanonical('1,234,567.89')).toBe('1234567.89')
    })
  })

  describe('auto-detection with a single separator', () => {
    it('treats 1-2 trailing digits as a decimal', () => {
      expect(parseDecimalToCanonical('1234,56')).toBe('1234.56')
      expect(parseDecimalToCanonical('1234.5')).toBe('1234.5')
    })
    it('treats exactly 3 trailing digits as grouping', () => {
      expect(parseDecimalToCanonical('1,234')).toBe('1234')
      expect(parseDecimalToCanonical('1.234')).toBe('1234')
    })
  })

  describe('signs, symbols, and whitespace', () => {
    it('strips currency symbols and spaces', () => {
      expect(parseDecimalToCanonical('  € 1.234,56 ')).toBe('1234.56')
      expect(parseDecimalToCanonical('$1,234.56')).toBe('1234.56')
    })
    it('keeps a leading minus', () => {
      expect(parseDecimalToCanonical('-50,00', { decimal: ',' })).toBe('-50')
    })
    it('reads accounting parentheses as negative', () => {
      expect(parseDecimalToCanonical('(1.234,56)')).toBe('-1234.56')
    })
    it('does not sign a zero', () => {
      expect(parseDecimalToCanonical('-0,00', { decimal: ',' })).toBe('0')
    })
  })

  describe('invalid input', () => {
    it('returns null for empty / non-numeric', () => {
      expect(parseDecimalToCanonical('')).toBeNull()
      expect(parseDecimalToCanonical('   ')).toBeNull()
      expect(parseDecimalToCanonical('abc')).toBeNull()
    })
  })
})

describe('parseDateToIso', () => {
  it('parses ISO directly', () => {
    expect(parseDateToIso('2026-06-23')).toBe('2026-06-23')
  })
  it('defaults ambiguous dates to day/month/year (ES)', () => {
    expect(parseDateToIso('01/02/2026')).toBe('2026-02-01')
  })
  it('honors an explicit mdy order', () => {
    expect(parseDateToIso('01/02/2026', 'mdy')).toBe('2026-01-02')
  })
  it('infers dmy when the first component is > 12', () => {
    expect(parseDateToIso('23/06/2026')).toBe('2026-06-23')
  })
  it('infers mdy when the second component is > 12', () => {
    expect(parseDateToIso('06/23/2026')).toBe('2026-06-23')
  })
  it('accepts dot and dash separators', () => {
    expect(parseDateToIso('23.06.2026')).toBe('2026-06-23')
    expect(parseDateToIso('23-06-2026')).toBe('2026-06-23')
  })
  it('expands 2-digit years to 2000s', () => {
    expect(parseDateToIso('23/06/26')).toBe('2026-06-23')
  })
  it('rejects impossible dates', () => {
    expect(parseDateToIso('31/02/2026')).toBeNull()
    expect(parseDateToIso('45/45/2026')).toBeNull()
    expect(parseDateToIso('not a date')).toBeNull()
  })
  it('respects leap years', () => {
    expect(parseDateToIso('29/02/2024')).toBe('2024-02-29')
    expect(parseDateToIso('29/02/2026')).toBeNull()
  })

  describe('ISO datetimes (date part only)', () => {
    it('takes the date from a space-separated datetime', () => {
      expect(parseDateToIso('2026-06-23 12:34:56', 'ymd')).toBe('2026-06-23')
    })
    it('takes the date from a T-separated datetime with Z', () => {
      expect(parseDateToIso('2026-06-23T12:34:56Z', 'ymd')).toBe('2026-06-23')
    })
    it('handles a fractional/offset tail', () => {
      expect(parseDateToIso('2026-06-23T12:34:56.789+02:00', 'ymd')).toBe(
        '2026-06-23'
      )
    })
    it('takes the date part of a dmy datetime', () => {
      expect(parseDateToIso('23/06/2026 12:34', 'dmy')).toBe('2026-06-23')
    })
    it('leaves a plain date unchanged', () => {
      expect(parseDateToIso('2026-06-23', 'ymd')).toBe('2026-06-23')
    })
    it('returns null for a time-only string', () => {
      expect(parseDateToIso('12:34:56', 'ymd')).toBeNull()
    })
  })
})
