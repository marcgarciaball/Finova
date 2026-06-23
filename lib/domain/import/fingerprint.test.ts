import { describe, expect, it } from 'vitest'
import {
  descriptionSimilarity,
  fingerprintKey,
  isFuzzyDuplicate,
  levenshtein,
  normalizeDescription,
  transactionFingerprint,
} from './fingerprint'

const base = {
  accountId: 'acc-1',
  occurredAt: '2026-06-23T00:00:00Z',
  amountCents: -1299,
  description: 'Coffee Shop',
}

describe('normalizeDescription', () => {
  it('lowercases, strips accents and punctuation, collapses whitespace', () => {
    expect(normalizeDescription('CAFÉ  Nº1')).toBe('cafe n 1')
    expect(normalizeDescription('  Mercadona, S.A.  ')).toBe('mercadona s a')
  })
})

describe('fingerprintKey / transactionFingerprint', () => {
  it('is stable across re-imports of the same row', () => {
    expect(transactionFingerprint(base)).toBe(transactionFingerprint(base))
  })

  it('ignores the time portion of the date and description casing/spacing', () => {
    const a = transactionFingerprint(base)
    const b = transactionFingerprint({
      ...base,
      occurredAt: '2026-06-23T18:42:00Z',
      description: 'coffee   shop',
    })
    expect(a).toBe(b)
  })

  it('differs when the amount differs', () => {
    expect(transactionFingerprint(base)).not.toBe(
      transactionFingerprint({ ...base, amountCents: -1300 })
    )
  })

  it('differs across accounts', () => {
    expect(transactionFingerprint(base)).not.toBe(
      transactionFingerprint({ ...base, accountId: 'acc-2' })
    )
  })

  it('produces an 8-char hex fingerprint', () => {
    expect(transactionFingerprint(base)).toMatch(/^[0-9a-f]{8}$/)
  })

  it('key is the readable composite', () => {
    expect(fingerprintKey(base)).toBe('acc-1|2026-06-23|-1299|coffee shop')
  })
})

describe('levenshtein', () => {
  it('is zero for identical strings', () => {
    expect(levenshtein('abc', 'abc')).toBe(0)
  })
  it('counts single edits', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
  })
  it('handles empty strings', () => {
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('abc', '')).toBe(3)
  })
})

describe('descriptionSimilarity', () => {
  it('is 1 for equal (normalized) descriptions', () => {
    expect(descriptionSimilarity('Coffee Shop', 'coffee   shop')).toBe(1)
  })
  it('is between 0 and 1 for near matches', () => {
    const s = descriptionSimilarity('Coffee Shop', 'Coffee Shopp')
    expect(s).toBeGreaterThan(0.85)
    expect(s).toBeLessThan(1)
  })
})

describe('isFuzzyDuplicate', () => {
  it('flags same date+amount with a near-identical description', () => {
    expect(
      isFuzzyDuplicate(base, { ...base, description: 'Coffee Shop ' })
    ).toBe(true)
  })

  it('rejects a different amount', () => {
    expect(isFuzzyDuplicate(base, { ...base, amountCents: -1300 })).toBe(false)
  })

  it('rejects a different date', () => {
    expect(
      isFuzzyDuplicate(base, { ...base, occurredAt: '2026-06-24T00:00:00Z' })
    ).toBe(false)
  })

  it('rejects a dissimilar description', () => {
    expect(
      isFuzzyDuplicate(base, { ...base, description: 'Gas Station' })
    ).toBe(false)
  })

  it('respects a custom threshold', () => {
    const a = base
    const b = { ...base, description: 'Coffee Shoppe Downtown' }
    expect(isFuzzyDuplicate(a, b, { threshold: 0.95 })).toBe(false)
    expect(isFuzzyDuplicate(a, b, { threshold: 0.4 })).toBe(true)
  })
})
