import { describe, expect, it } from 'vitest'
import { headerSignature } from './mapping'
import { parseUploadBytes } from './parse-upload'

const enc = (s: string) => new TextEncoder().encode(s)

describe('parseUploadBytes', () => {
  it('parses a simple CSV into headers + sample records + signature', () => {
    const out = parseUploadBytes(
      'movements.csv',
      enc(
        'Date,Amount,Description\n2026-01-02,-12.50,Coffee\n2026-01-03,100,Salary\n'
      )
    )
    expect(out.ok).toBe(true)
    if (!out.ok) {
      return
    }
    expect(out.data.headers).toEqual(['Date', 'Amount', 'Description'])
    expect(out.data.sampleRecords).toEqual([
      { Date: '2026-01-02', Amount: '-12.50', Description: 'Coffee' },
      { Date: '2026-01-03', Amount: '100', Description: 'Salary' },
    ])
    expect(out.data.rowCount).toBe(2)
    expect(out.data.signature).toBe(
      headerSignature(['Date', 'Amount', 'Description'])
    )
  })

  it('detects a semicolon delimiter', () => {
    const out = parseUploadBytes('x.csv', enc('A;B\n1;2\n'))
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.data.headers).toEqual(['A', 'B'])
    }
  })

  it('rejects a non-.csv filename', () => {
    const out = parseUploadBytes('statement.pdf', enc('A,B\n1,2\n'))
    expect(out).toEqual({ ok: false, error: 'notCsv' })
  })

  it('accepts a .CSV filename case-insensitively', () => {
    const out = parseUploadBytes('STATEMENT.CSV', enc('A,B\n1,2\n'))
    expect(out.ok).toBe(true)
  })

  it('rejects an empty file', () => {
    const out = parseUploadBytes('x.csv', enc(''))
    expect(out).toEqual({ ok: false, error: 'emptyFile' })
  })

  it('rejects a file over the byte cap', () => {
    const out = parseUploadBytes('x.csv', enc('A,B\n1,2\n'), { maxBytes: 4 })
    expect(out).toEqual({ ok: false, error: 'tooLarge' })
  })

  it('rejects a file with no data rows', () => {
    const out = parseUploadBytes('x.csv', enc('A,B,C\n'))
    expect(out).toEqual({ ok: false, error: 'noRows' })
  })

  it('rejects a file over the row cap', () => {
    const out = parseUploadBytes('x.csv', enc('A,B\n1,2\n3,4\n5,6\n'), {
      maxRows: 2,
    })
    expect(out).toEqual({ ok: false, error: 'tooManyRows' })
  })

  it('caps the sample records but reports the full row count', () => {
    const body = ['A,B', '1,2', '3,4', '5,6', '7,8'].join('\n')
    const out = parseUploadBytes('x.csv', enc(body), { sampleSize: 2 })
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.data.sampleRecords).toHaveLength(2)
      expect(out.data.rowCount).toBe(4)
    }
  })

  it('falls back to Latin-1 for non-UTF-8 bytes (accented merchant)', () => {
    // 'Café' with the é as a single Latin-1 byte (0xE9).
    const bytes = new Uint8Array([...enc('A,B\n1,Caf'), 0xe9, ...enc('\n')])
    const out = parseUploadBytes('x.csv', bytes)
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.data.encoding).toBe('latin1')
      expect(out.data.sampleRecords[0]?.B).toBe('Café')
    }
  })
})
