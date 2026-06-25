import { describe, expect, it } from 'vitest'
import { transactionFingerprint } from './fingerprint'
import type { ColumnMapping } from './mapping'
import { reviewRows } from './review'

const mapping: ColumnMapping = {
  date: { column: 'Date', format: 'ymd' },
  amount: {
    kind: 'single',
    column: 'Amount',
    negativeIs: 'expense',
    decimal: '.',
  },
  description: { column: 'Desc' },
}

const rec = (date: string, amount: string, desc: string) => ({
  Date: date,
  Amount: amount,
  Desc: desc,
})

describe('reviewRows', () => {
  it('classifies a fresh row as new', () => {
    const res = reviewRows(
      [rec('2026-01-01', '-12.99', 'Coffee')],
      mapping,
      'acc-1',
      new Set()
    )
    expect(res.counts).toEqual({ new: 1, duplicate: 0, error: 0 })
    expect(res.rows[0]).toMatchObject({ index: 1, status: 'new' })
    expect(res.rows[0].txn?.amountCents).toBe(-1299)
  })

  it('marks a row whose fingerprint already exists as a duplicate', () => {
    const fp = transactionFingerprint({
      accountId: 'acc-1',
      amountCents: -1299,
      description: 'Coffee',
      occurredAt: '2026-01-01',
    })
    const res = reviewRows(
      [rec('2026-01-01', '-12.99', 'Coffee')],
      mapping,
      'acc-1',
      new Set([fp])
    )
    expect(res.counts).toEqual({ new: 0, duplicate: 1, error: 0 })
    expect(res.rows[0].status).toBe('duplicate')
  })

  it('marks a second identical row in the same batch as a duplicate (intra-batch)', () => {
    const res = reviewRows(
      [
        rec('2026-01-01', '-12.99', 'Coffee'),
        rec('2026-01-01', '-12.99', 'Coffee'),
      ],
      mapping,
      'acc-1',
      new Set()
    )
    expect(res.counts).toEqual({ new: 1, duplicate: 1, error: 0 })
    expect(res.rows.map((r) => r.status)).toEqual(['new', 'duplicate'])
  })

  it('routes an unparseable row to the error count instead of throwing', () => {
    const res = reviewRows(
      [rec('2026-01-01', 'not-a-number', 'Coffee')],
      mapping,
      'acc-1',
      new Set()
    )
    expect(res.counts).toEqual({ new: 0, duplicate: 0, error: 1 })
    expect(res.rows[0].status).toBe('error')
    expect(res.rows[0].error).toBeDefined()
  })

  it('flags a near-duplicate of an existing row as fuzzy without changing the counts', () => {
    // same date+amount, description differs by a few chars → fuzzy advisory
    const res = reviewRows(
      [rec('2026-01-01', '-12.99', 'Coffee Shp')],
      mapping,
      'acc-1',
      new Set(),
      {
        seenTxns: [
          {
            amountCents: -1299,
            description: 'Coffee Shop',
            occurredAt: '2026-01-01',
          },
        ],
      }
    )
    expect(res.counts.new).toBe(1)
    expect(res.rows[0].fuzzy).toBe(true)
  })

  it('returns zeroed counts for empty input', () => {
    const res = reviewRows([], mapping, 'acc-1', new Set())
    expect(res.counts).toEqual({ new: 0, duplicate: 0, error: 0 })
    expect(res.rows).toEqual([])
  })
})
