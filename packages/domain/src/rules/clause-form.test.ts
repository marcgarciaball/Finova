import { describe, expect, it } from 'vitest'
import {
  buildConditions,
  type ClauseDraft,
  draftsFromConditions,
  emptyDraft,
} from './clause-form'
import type { RuleConditions } from './types'

const ACCOUNT = '22222222-2222-4222-8222-222222222222'

describe('emptyDraft', () => {
  it('picks a valid default op per field', () => {
    expect(emptyDraft('description').op).toBe('contains')
    expect(emptyDraft('amount_cents').op).toBe('gt')
    expect(emptyDraft('account_id').op).toBe('eq')
  })
})

describe('buildConditions', () => {
  it('maps a description clause verbatim', () => {
    const drafts: ClauseDraft[] = [
      {
        field: 'description',
        op: 'contains',
        value: 'Mercadona',
        absolute: false,
      },
    ]
    expect(buildConditions(drafts)).toEqual([
      { field: 'description', op: 'contains', value: 'Mercadona' },
    ])
  })

  it('converts a major-unit amount to signed integer cents (no float drift)', () => {
    const drafts: ClauseDraft[] = [
      { field: 'amount_cents', op: 'lt', value: '-19.99', absolute: false },
    ]
    expect(buildConditions(drafts)).toEqual([
      { field: 'amount_cents', op: 'lt', value: -1999, absolute: false },
    ])
  })

  it('carries the absolute flag on amount clauses', () => {
    const drafts: ClauseDraft[] = [
      { field: 'amount_cents', op: 'gte', value: '50', absolute: true },
    ]
    expect(buildConditions(drafts)[0]).toMatchObject({
      absolute: true,
      value: 5000,
    })
  })

  it('produces NaN for a malformed amount so validation rejects it', () => {
    const drafts: ClauseDraft[] = [
      { field: 'amount_cents', op: 'eq', value: 'abc', absolute: false },
    ]
    const clause = buildConditions(drafts)[0]
    expect(clause.field).toBe('amount_cents')
    if (clause.field === 'amount_cents') {
      expect(Number.isNaN(clause.value)).toBe(true)
    }
  })

  it('maps an account clause to eq', () => {
    const drafts: ClauseDraft[] = [
      { field: 'account_id', op: 'eq', value: ACCOUNT, absolute: false },
    ]
    expect(buildConditions(drafts)).toEqual([
      { field: 'account_id', op: 'eq', value: ACCOUNT },
    ])
  })
})

describe('round-trip', () => {
  it('draftsFromConditions inverts buildConditions for well-formed drafts', () => {
    const conditions: RuleConditions = [
      { field: 'description', op: 'starts_with', value: 'PAGO' },
      { field: 'amount_cents', op: 'lte', value: -1050, absolute: true },
      { field: 'account_id', op: 'eq', value: ACCOUNT },
    ]
    expect(buildConditions(draftsFromConditions(conditions))).toEqual(
      conditions
    )
  })

  it('formats cents back to a 2-decimal major string', () => {
    const drafts = draftsFromConditions([
      { field: 'amount_cents', op: 'gt', value: 12345 },
    ])
    expect(drafts[0]?.value).toBe('123.45')
  })
})
