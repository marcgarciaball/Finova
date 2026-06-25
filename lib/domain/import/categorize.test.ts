import { describe, expect, it } from 'vitest'
import type { RawTxn } from './adapter'
import { applyImportCategorization } from './categorize'

const txn = (description: string): RawTxn => ({
  amountCents: -1000,
  description,
  occurredAt: '2026-01-15',
})

describe('applyImportCategorization', () => {
  it('returns null for every row when no rules are given', () => {
    const txns = [txn('Coffee'), txn('Rent'), txn('Salary')]
    expect(applyImportCategorization(txns, [])).toEqual([null, null, null])
  })

  it('preserves length and index alignment for an empty input', () => {
    expect(applyImportCategorization([], [])).toEqual([])
  })

  it('returns one entry per input row', () => {
    const txns = [txn('a'), txn('b')]
    expect(applyImportCategorization(txns, [])).toHaveLength(txns.length)
  })
})
