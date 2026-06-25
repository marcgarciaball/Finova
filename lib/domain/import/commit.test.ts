import { describe, expect, it } from 'vitest'
import type { RawTxn } from './adapter'
import { buildCommitRows, CHUNK_SIZE } from './commit'
import { transactionFingerprint } from './fingerprint'

const ACCOUNT = 'acct-1'
const USER = 'user-1'

const txn = (over: Partial<RawTxn> = {}): RawTxn => ({
  amountCents: -1234,
  description: 'Coffee',
  occurredAt: '2026-01-15',
  ...over,
})

const ctx = (over: Partial<Parameters<typeof buildCommitRows>[1]> = {}) => ({
  userId: USER,
  accountId: ACCOUNT,
  fallbackCurrency: 'EUR',
  categoryIds: [],
  ...over,
})

describe('buildCommitRows', () => {
  it('stores occurred_at as UTC midnight', () => {
    const [row] = buildCommitRows([txn({ occurredAt: '2026-03-09' })], ctx())
    expect(row?.occurred_at).toBe('2026-03-09T00:00:00.000Z')
  })

  it('uses the row currency when present, else the fallback', () => {
    const rows = buildCommitRows(
      [txn({ currency: 'USD' }), txn({})],
      ctx({ fallbackCurrency: 'EUR' })
    )
    expect(rows[0]?.currency).toBe('USD')
    expect(rows[1]?.currency).toBe('EUR')
  })

  it('computes an import_fingerprint that matches review.ts inputs', () => {
    const t = txn({
      amountCents: -555,
      description: 'Tienda',
      occurredAt: '2026-02-02',
    })
    const [row] = buildCommitRows([t], ctx())
    expect(row?.import_fingerprint).toBe(
      transactionFingerprint({
        accountId: ACCOUNT,
        amountCents: -555,
        description: 'Tienda',
        occurredAt: '2026-02-02',
      })
    )
  })

  it('takes category_id from categoryIds by index, defaulting to null', () => {
    const rows = buildCommitRows(
      [txn(), txn(), txn()],
      ctx({ categoryIds: ['cat-a', null] })
    )
    expect(rows[0]?.category_id).toBe('cat-a')
    expect(rows[1]?.category_id).toBeNull()
    expect(rows[2]?.category_id).toBeNull()
  })

  it('sets stable defaults and carries user/account/note/tags', () => {
    const [row] = buildCommitRows([txn({ note: 'memo' })], ctx())
    expect(row).toMatchObject({
      user_id: USER,
      account_id: ACCOUNT,
      note: 'memo',
      tags: [],
      is_recurring: false,
      is_transfer: false,
    })
  })

  it('defaults a missing note to null', () => {
    const [row] = buildCommitRows([txn({})], ctx())
    expect(row?.note).toBeNull()
  })

  it('exposes a positive chunk size', () => {
    expect(CHUNK_SIZE).toBeGreaterThan(0)
  })
})
