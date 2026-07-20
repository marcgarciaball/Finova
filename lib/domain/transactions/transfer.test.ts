import { describe, expect, it } from 'vitest'
import { buildTransferLegs } from '@/lib/domain/transactions/transfer'

const INPUT = {
  amountCents: 12_345,
  currency: 'EUR',
  description: 'Transfer',
  fromAccountId: 'acc-from',
  groupId: 'group-1',
  occurredAtIso: '2026-07-17T00:00:00.000Z',
  toAccountId: 'acc-to',
}

describe('buildTransferLegs', () => {
  it('builds a negative source leg and a positive destination leg', () => {
    const [source, dest] = buildTransferLegs(INPUT)
    expect(source?.account_id).toBe('acc-from')
    expect(source?.amount_cents).toBe(-12_345)
    expect(dest?.account_id).toBe('acc-to')
    expect(dest?.amount_cents).toBe(12_345)
  })

  it('marks both legs as one transfer group', () => {
    for (const leg of buildTransferLegs(INPUT)) {
      expect(leg.is_transfer).toBe(true)
      expect(leg.transfer_group_id).toBe('group-1')
      expect(leg.category_id).toBeNull()
      expect(leg.currency).toBe('EUR')
      expect(leg.occurred_at).toBe(INPUT.occurredAtIso)
    }
  })

  it('nets to zero across the two legs', () => {
    const legs = buildTransferLegs(INPUT)
    expect(legs.reduce((sum, l) => sum + l.amount_cents, 0)).toBe(0)
  })

  it('normalizes a negative magnitude (sign owned by the legs, not the input)', () => {
    const [source, dest] = buildTransferLegs({ ...INPUT, amountCents: -500 })
    expect(source?.amount_cents).toBe(-500)
    expect(dest?.amount_cents).toBe(500)
  })
})
