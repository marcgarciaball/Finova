import { describe, expect, it } from 'vitest'
import { EXPORT_DOMAINS, parseExportDomains } from './domains'

describe('parseExportDomains', () => {
  it('defaults to every domain when absent or empty', () => {
    expect(parseExportDomains(null)).toEqual([...EXPORT_DOMAINS])
    expect(parseExportDomains('')).toEqual([...EXPORT_DOMAINS])
  })

  it('keeps only known tokens, in canonical order', () => {
    expect(parseExportDomains('realEstate,transactions')).toEqual([
      'transactions',
      'realEstate',
    ])
  })

  it('drops unknown tokens and falls back to all when none remain', () => {
    expect(parseExportDomains('investments,bogus')).toEqual(['investments'])
    expect(parseExportDomains('nonsense')).toEqual([...EXPORT_DOMAINS])
  })
})
