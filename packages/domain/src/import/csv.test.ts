import { describe, expect, it } from 'vitest'
import { detectDelimiter, parseCsv, rowsToRecords, sanitizeCell } from './csv'

describe('detectDelimiter', () => {
  it('detects comma, semicolon, and tab', () => {
    expect(detectDelimiter('a,b,c')).toBe(',')
    expect(detectDelimiter('a;b;c')).toBe(';')
    expect(detectDelimiter('a\tb\tc')).toBe('\t')
  })
  it('ignores delimiters inside quotes', () => {
    expect(detectDelimiter('"a,b";c;d')).toBe(';')
  })
  it('falls back to comma', () => {
    expect(detectDelimiter('singlecolumn')).toBe(',')
  })
  it('skips leading blank lines', () => {
    expect(detectDelimiter('\n\na;b;c')).toBe(';')
  })
})

describe('parseCsv', () => {
  it('parses a simple file with a header', () => {
    const out = parseCsv('date,amount,desc\n2026-01-01,10.00,Coffee')
    expect(out.headers).toEqual(['date', 'amount', 'desc'])
    expect(out.rows).toEqual([['2026-01-01', '10.00', 'Coffee']])
  })

  it('handles quoted fields containing the delimiter', () => {
    const out = parseCsv('a,b\n"x,y",z')
    expect(out.rows).toEqual([['x,y', 'z']])
  })

  it('handles escaped quotes', () => {
    const out = parseCsv('a\n"she said ""hi"""')
    expect(out.rows).toEqual([['she said "hi"']])
  })

  it('handles newlines inside quoted fields', () => {
    const out = parseCsv('a,b\n"line1\nline2",z')
    expect(out.rows).toEqual([['line1\nline2', 'z']])
  })

  it('handles CRLF line endings', () => {
    const out = parseCsv('a,b\r\n1,2\r\n3,4')
    expect(out.rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ])
  })

  it('does not emit a trailing empty row for a final newline', () => {
    const out = parseCsv('a,b\n1,2\n')
    expect(out.rows).toEqual([['1', '2']])
  })

  it('respects an explicit delimiter and header:false', () => {
    const out = parseCsv('1;2;3', { delimiter: ';', header: false })
    expect(out.headers).toEqual([])
    expect(out.rows).toEqual([['1', '2', '3']])
  })

  it('returns empty for empty input', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [] })
  })
})

describe('sanitizeCell', () => {
  it('neutralizes formula triggers', () => {
    expect(sanitizeCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)")
    expect(sanitizeCell('+1')).toBe("'+1")
    expect(sanitizeCell('-cmd')).toBe("'-cmd")
    expect(sanitizeCell('@foo')).toBe("'@foo")
  })
  it('leaves ordinary values untouched', () => {
    expect(sanitizeCell('Coffee Shop')).toBe('Coffee Shop')
    expect(sanitizeCell('100')).toBe('100')
    expect(sanitizeCell('')).toBe('')
  })
})

describe('rowsToRecords', () => {
  it('keys cells by header', () => {
    const parsed = parseCsv('date,amount\n2026-01-01,10.00')
    expect(rowsToRecords(parsed)).toEqual([
      { date: '2026-01-01', amount: '10.00' },
    ])
  })
  it('fills missing trailing cells with empty strings', () => {
    const parsed = parseCsv('a,b,c\n1,2')
    expect(rowsToRecords(parsed)).toEqual([{ a: '1', b: '2', c: '' }])
  })
})
