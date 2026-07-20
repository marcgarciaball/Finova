import { describe, expect, it } from 'vitest'
import {
  type CategorizationRuleRow,
  conditionsSchema,
  createCategorizationRuleSchema,
  toDomainRule,
  updateCategorizationRuleSchema,
} from '@/lib/validation/categorization-rule'

const CATEGORY_ID = '11111111-1111-4111-8111-111111111111'
const ACCOUNT_ID = '22222222-2222-4222-8222-222222222222'
const RULE_ID = '33333333-3333-4333-8333-333333333333'

describe('conditionsSchema', () => {
  it('accepts a description clause', () => {
    const result = conditionsSchema.safeParse([
      { field: 'description', op: 'contains', value: 'mercadona' },
    ])
    expect(result.success).toBe(true)
  })

  it('accepts a signed amount clause', () => {
    const result = conditionsSchema.safeParse([
      { field: 'amount_cents', op: 'lt', value: -5000 },
    ])
    expect(result.success).toBe(true)
  })

  it('accepts an amount clause with the absolute flag', () => {
    const result = conditionsSchema.safeParse([
      { field: 'amount_cents', op: 'gte', value: 10000, absolute: true },
    ])
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data[0]).toMatchObject({ absolute: true })
    }
  })

  it('accepts an account clause', () => {
    const result = conditionsSchema.safeParse([
      { field: 'account_id', op: 'eq', value: ACCOUNT_ID },
    ])
    expect(result.success).toBe(true)
  })

  it('accepts multiple AND-combined clauses', () => {
    const result = conditionsSchema.safeParse([
      { field: 'description', op: 'contains', value: 'uber' },
      { field: 'amount_cents', op: 'lt', value: 0 },
    ])
    expect(result.success).toBe(true)
  })

  it('rejects an empty conditions array', () => {
    expect(conditionsSchema.safeParse([]).success).toBe(false)
  })

  it('rejects an unknown field', () => {
    expect(
      conditionsSchema.safeParse([{ field: 'merchant', op: 'eq', value: 'x' }])
        .success
    ).toBe(false)
  })

  it('rejects an unknown description op', () => {
    expect(
      conditionsSchema.safeParse([
        { field: 'description', op: 'matches', value: 'x' },
      ]).success
    ).toBe(false)
  })

  it('rejects an empty description value', () => {
    expect(
      conditionsSchema.safeParse([
        { field: 'description', op: 'contains', value: '' },
      ]).success
    ).toBe(false)
  })

  it('rejects a regex value over 200 chars (ReDoS cap)', () => {
    const long = 'a'.repeat(201)
    expect(
      conditionsSchema.safeParse([
        { field: 'description', op: 'regex', value: long },
      ]).success
    ).toBe(false)
    expect(
      conditionsSchema.safeParse([
        { field: 'description', op: 'regex', value: 'a'.repeat(200) },
      ]).success
    ).toBe(true)
  })

  it('rejects a non-integer amount value', () => {
    expect(
      conditionsSchema.safeParse([
        { field: 'amount_cents', op: 'eq', value: 12.5 },
      ]).success
    ).toBe(false)
  })

  it('rejects a non-eq account op', () => {
    expect(
      conditionsSchema.safeParse([
        { field: 'account_id', op: 'lt', value: ACCOUNT_ID },
      ]).success
    ).toBe(false)
  })

  it('rejects a non-uuid account value', () => {
    expect(
      conditionsSchema.safeParse([
        { field: 'account_id', op: 'eq', value: 'not-a-uuid' },
      ]).success
    ).toBe(false)
  })

  it('rejects a clause carrying an unknown key (trusts nothing)', () => {
    // The conditions jsonb trusts nothing — an unexpected key (typo / stale
    // field) must be rejected, not silently stripped.
    expect(
      conditionsSchema.safeParse([
        { field: 'description', op: 'contains', value: 'x', flags: 'i' },
      ]).success
    ).toBe(false)
  })
})

describe('createCategorizationRuleSchema', () => {
  const base = {
    name: 'Groceries',
    categoryId: CATEGORY_ID,
    conditions: [{ field: 'description', op: 'contains', value: 'lidl' }],
  }

  it('accepts a minimal valid rule and defaults priority/enabled', () => {
    const result = createCategorizationRuleSchema.safeParse(base)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.priority).toBe(0)
      expect(result.data.enabled).toBe(true)
    }
  })

  it('honors explicit priority and enabled', () => {
    const result = createCategorizationRuleSchema.safeParse({
      ...base,
      priority: 5,
      enabled: false,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.priority).toBe(5)
      expect(result.data.enabled).toBe(false)
    }
  })

  it('trims the name and rejects blank/over-long names', () => {
    expect(
      createCategorizationRuleSchema.safeParse({ ...base, name: '   ' }).success
    ).toBe(false)
    expect(
      createCategorizationRuleSchema.safeParse({
        ...base,
        name: 'x'.repeat(101),
      }).success
    ).toBe(false)
  })

  it('rejects a negative priority', () => {
    expect(
      createCategorizationRuleSchema.safeParse({ ...base, priority: -1 })
        .success
    ).toBe(false)
  })

  it('rejects a priority that overflows the integer column', () => {
    // Postgres `integer` max is 2147483647; the validator must reject past it
    // so an oversized priority fails cleanly, not as an opaque DB error.
    expect(
      createCategorizationRuleSchema.safeParse({
        ...base,
        priority: 2147483648,
      }).success
    ).toBe(false)
    expect(
      createCategorizationRuleSchema.safeParse({
        ...base,
        priority: 2147483647,
      }).success
    ).toBe(true)
  })

  it('rejects a non-uuid categoryId', () => {
    expect(
      createCategorizationRuleSchema.safeParse({ ...base, categoryId: 'nope' })
        .success
    ).toBe(false)
  })

  it('rejects empty conditions', () => {
    expect(
      createCategorizationRuleSchema.safeParse({ ...base, conditions: [] })
        .success
    ).toBe(false)
  })
})

describe('updateCategorizationRuleSchema', () => {
  it('requires an id and allows partial fields', () => {
    const result = updateCategorizationRuleSchema.safeParse({
      id: RULE_ID,
      enabled: false,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a missing id', () => {
    expect(
      updateCategorizationRuleSchema.safeParse({ enabled: false }).success
    ).toBe(false)
  })

  it('rejects a non-uuid id', () => {
    expect(
      updateCategorizationRuleSchema.safeParse({ id: 'nope' }).success
    ).toBe(false)
  })
})

describe('toDomainRule', () => {
  const row: CategorizationRuleRow = {
    id: RULE_ID,
    user_id: '44444444-4444-4444-4444-444444444444',
    name: 'Groceries',
    name_key: null,
    conditions: [{ field: 'description', op: 'contains', value: 'lidl' }],
    category_id: CATEGORY_ID,
    priority: 7,
    enabled: false,
    is_default: false,
    created_at: '2026-06-28T00:00:00Z',
    updated_at: '2026-06-28T00:00:00Z',
  }

  it('maps a persisted row to the camelCase domain Rule', () => {
    expect(toDomainRule(row)).toEqual({
      id: RULE_ID,
      categoryId: CATEGORY_ID,
      conditions: [{ field: 'description', op: 'contains', value: 'lidl' }],
      priority: 7,
      enabled: false,
    })
  })
})
