import { describe, expect, it } from 'vitest'
import { parseCsv, rowsToRecords } from '@/lib/domain/import/csv'
import { toCsv } from './serialize'

describe('toCsv', () => {
  it('writes a header row then data rows, CRLF-joined', () => {
    const csv = toCsv(
      ['a', 'b'],
      [
        ['1', '2'],
        ['3', '4'],
      ]
    )
    expect(csv).toBe('a,b\r\n1,2\r\n3,4')
  })

  it('quotes fields containing a comma, quote, or newline', () => {
    expect(toCsv(['x'], [['a,b']])).toBe('x\r\n"a,b"')
    expect(toCsv(['x'], [['say "hi"']])).toBe('x\r\n"say ""hi"""')
    expect(toCsv(['x'], [['line1\nline2']])).toBe('x\r\n"line1\nline2"')
  })

  it('leaves an ordinary value unquoted', () => {
    expect(toCsv(['x'], [['plain']])).toBe('x\r\nplain')
  })

  it('sanitizes string cells that start with a formula trigger', () => {
    expect(toCsv(['x'], [['=SUM(A1)']])).toBe("x\r\n'=SUM(A1)")
    expect(toCsv(['x'], [['@cmd']])).toBe("x\r\n'@cmd")
  })

  it('emits a numeric cell verbatim (no formula-sanitize) for round-trip safety', () => {
    expect(toCsv(['amount'], [[-50]])).toBe('amount\r\n-50')
    expect(toCsv(['amount'], [[1234]])).toBe('amount\r\n1234')
  })

  it('renders null/undefined as an empty field', () => {
    expect(toCsv(['a', 'b'], [[null, undefined]])).toBe('a,b\r\n,')
  })

  it('writes just the header line when there are no rows', () => {
    expect(toCsv(['a', 'b'], [])).toBe('a,b')
  })

  it('round-trips back through parseCsv', () => {
    const csv = toCsv(
      ['description', 'amount'],
      [
        ['Coffee, large', -350],
        ['Salary "May"', 200_000],
      ]
    )
    const records = rowsToRecords(parseCsv(csv))
    expect(records).toEqual([
      { description: 'Coffee, large', amount: '-350' },
      { description: 'Salary "May"', amount: '200000' },
    ])
  })
})
