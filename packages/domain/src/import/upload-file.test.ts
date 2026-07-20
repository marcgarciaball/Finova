import { describe, expect, it } from 'vitest'
import { validateUpload } from './upload-file'

const KB = 1024

describe('validateUpload', () => {
  it('accepts a .csv and reports the csv kind with a normalized content type', () => {
    const r = validateUpload({ name: 'bank.csv', size: 10 * KB })
    expect(r).toEqual({ ok: true, kind: 'csv', contentType: 'text/csv' })
  })

  it('accepts .xls and .xlsx as the excel kind', () => {
    expect(validateUpload({ name: 'bank.xls', size: KB })).toEqual({
      ok: true,
      kind: 'excel',
      contentType: 'application/vnd.ms-excel',
    })
    expect(validateUpload({ name: 'bank.xlsx', size: KB })).toEqual({
      ok: true,
      kind: 'excel',
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  })

  it('derives content type from the extension, not the browser-supplied type', () => {
    const r = validateUpload({
      name: 'bank.csv',
      size: KB,
      type: 'application/octet-stream',
    })
    expect(r).toEqual({ ok: true, kind: 'csv', contentType: 'text/csv' })
  })

  it('is case-insensitive on the extension', () => {
    expect(validateUpload({ name: 'BANK.CSV', size: KB }).ok).toBe(true)
  })

  it('rejects an empty file as noFile', () => {
    expect(validateUpload({ name: 'bank.csv', size: 0 })).toEqual({
      ok: false,
      error: 'noFile',
    })
  })

  it('rejects a blank name as noFile', () => {
    expect(validateUpload({ name: '   ', size: KB })).toEqual({
      ok: false,
      error: 'noFile',
    })
  })

  it('rejects a file over the 5 MB cap as tooLarge', () => {
    expect(
      validateUpload({ name: 'bank.csv', size: 5 * 1024 * 1024 + 1 })
    ).toEqual({ ok: false, error: 'tooLarge' })
  })

  it('rejects a disallowed extension as unsupportedType', () => {
    expect(validateUpload({ name: 'bank.pdf', size: KB })).toEqual({
      ok: false,
      error: 'unsupportedType',
    })
    expect(validateUpload({ name: 'bank', size: KB })).toEqual({
      ok: false,
      error: 'unsupportedType',
    })
  })
})
