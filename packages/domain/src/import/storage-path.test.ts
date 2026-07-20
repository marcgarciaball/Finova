import { describe, expect, it } from 'vitest'
import { buildStoragePath, isOwnedPath, safeName } from './storage-path'

const USER = '00000000-0000-0000-0000-00000000000a'
const BATCH = '11111111-1111-1111-1111-111111111111'

describe('safeName', () => {
  it('keeps a plain filename with its extension', () => {
    expect(safeName('statement.csv')).toBe('statement.csv')
  })

  it('strips directory components to defeat path traversal', () => {
    expect(safeName('../../etc/passwd.csv')).toBe('passwd.csv')
    expect(safeName('C:\\Users\\me\\bank.csv')).toBe('bank.csv')
  })

  it('removes control characters', () => {
    expect(safeName('bad\x07\x1fname.csv')).toBe('badname.csv')
  })

  it('replaces other unsafe characters with a dash', () => {
    expect(safeName('my bank (2024)*.csv')).toBe('my bank -2024--.csv')
  })

  it('does not produce a hidden dotfile', () => {
    expect(safeName('.htaccess.csv').startsWith('.')).toBe(false)
  })

  it('falls back to a non-empty name when nothing usable remains', () => {
    expect(safeName('///')).toBe('file')
    expect(safeName('')).toBe('file')
  })

  it('caps an overlong name while preserving the extension', () => {
    const long = `${'a'.repeat(500)}.csv`
    const out = safeName(long)
    expect(out.length).toBeLessThanOrEqual(120)
    expect(out.endsWith('.csv')).toBe(true)
  })
})

describe('buildStoragePath', () => {
  it('nests the sanitized name under the owner and batch prefix', () => {
    expect(buildStoragePath(USER, BATCH, '../x.csv')).toBe(
      `${USER}/${BATCH}/x.csv`
    )
  })
})

describe('isOwnedPath', () => {
  it('accepts a path whose first segment is the user', () => {
    expect(isOwnedPath(`${USER}/${BATCH}/x.csv`, USER)).toBe(true)
  })

  it('rejects a path under another user prefix', () => {
    expect(isOwnedPath(`other/${BATCH}/x.csv`, USER)).toBe(false)
  })

  it('rejects when the user id is empty', () => {
    expect(isOwnedPath('/x.csv', '')).toBe(false)
  })
})
