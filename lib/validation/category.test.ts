import {
  DEFAULT_CATEGORIES,
  DEFAULT_CATEGORY_KEYS,
} from '@finova/domain/categories/defaults'
import { describe, expect, it } from 'vitest'
import {
  categoryKindSchema,
  categoryRowSchema,
  createCategorySchema,
  updateCategorySchema,
} from '@/lib/validation/category'

const UUID = '11111111-1111-4111-8111-111111111111'

describe('categoryKindSchema', () => {
  it('accepts income and expense', () => {
    expect(categoryKindSchema.safeParse('income').success).toBe(true)
    expect(categoryKindSchema.safeParse('expense').success).toBe(true)
  })

  it('rejects anything else', () => {
    expect(categoryKindSchema.safeParse('transfer').success).toBe(false)
    expect(categoryKindSchema.safeParse('').success).toBe(false)
  })
})

describe('createCategorySchema', () => {
  it('accepts a top-level category (no parent)', () => {
    const r = createCategorySchema.safeParse({ name: 'Pets', kind: 'expense' })
    expect(r.success).toBe(true)
  })

  it('treats an empty parentId string as top-level (null)', () => {
    const r = createCategorySchema.safeParse({
      name: 'Pets',
      kind: 'expense',
      parentId: '',
    })
    expect(r.success && r.data.parentId).toBeNull()
  })

  it('accepts a uuid parentId (subcategory)', () => {
    const r = createCategorySchema.safeParse({
      name: 'Vet',
      kind: 'expense',
      parentId: UUID,
    })
    expect(r.success && r.data.parentId).toBe(UUID)
  })

  it('trims and rejects blank or overlong names', () => {
    expect(
      createCategorySchema.safeParse({ name: '   ', kind: 'expense' }).success
    ).toBe(false)
    expect(
      createCategorySchema.safeParse({ name: 'x'.repeat(101), kind: 'expense' })
        .success
    ).toBe(false)
  })

  it('rejects a non-uuid parentId', () => {
    expect(
      createCategorySchema.safeParse({
        name: 'Vet',
        kind: 'expense',
        parentId: 'nope',
      }).success
    ).toBe(false)
  })
})

describe('updateCategorySchema', () => {
  it('requires a uuid id', () => {
    expect(
      updateCategorySchema.safeParse({ name: 'Pets', kind: 'expense' }).success
    ).toBe(false)
    expect(
      updateCategorySchema.safeParse({
        id: UUID,
        name: 'Pets',
        kind: 'expense',
      }).success
    ).toBe(true)
  })
})

describe('categoryRowSchema', () => {
  it('parses a seeded (default) row with a name_key', () => {
    const r = categoryRowSchema.safeParse({
      id: UUID,
      user_id: UUID,
      parent_id: null,
      name: 'Housing',
      name_key: 'housing',
      kind: 'expense',
      is_default: true,
      icon_name: 'Home',
      color: 'var(--cat-blue)',
      created_at: '2026-06-22T00:00:00Z',
      updated_at: '2026-06-22T00:00:00Z',
    })
    expect(r.success).toBe(true)
  })

  it('parses a custom row (null name_key, with parent)', () => {
    const r = categoryRowSchema.safeParse({
      id: UUID,
      user_id: UUID,
      parent_id: UUID,
      name: 'Vet',
      name_key: null,
      kind: 'expense',
      is_default: false,
      icon_name: null,
      color: null,
      created_at: '2026-06-22T00:00:00Z',
      updated_at: '2026-06-22T00:00:00Z',
    })
    expect(r.success).toBe(true)
  })
})

describe('DEFAULT_CATEGORIES', () => {
  it('has unique name_keys across parents and children', () => {
    const unique = new Set(DEFAULT_CATEGORY_KEYS)
    expect(unique.size).toBe(DEFAULT_CATEGORY_KEYS.length)
  })

  it('only uses known kinds', () => {
    for (const c of DEFAULT_CATEGORIES) {
      expect(categoryKindSchema.safeParse(c.kind).success).toBe(true)
    }
  })
})

describe('icon/color (P5-01)', () => {
  it('accepts an allowlisted icon + color', () => {
    const r = createCategorySchema.safeParse({
      name: 'Pets',
      kind: 'expense',
      iconName: 'Home',
      color: 'var(--cat-blue)',
    })
    expect(r.success).toBe(true)
  })

  it('rejects an icon outside the allowlist', () => {
    const r = createCategorySchema.safeParse({
      name: 'Pets',
      kind: 'expense',
      iconName: 'NotARealIcon',
    })
    expect(r.success).toBe(false)
  })

  it('rejects an arbitrary color (no free-form hex)', () => {
    const r = createCategorySchema.safeParse({
      name: 'Pets',
      kind: 'expense',
      color: '#ff0000',
    })
    expect(r.success).toBe(false)
  })

  it('treats empty icon/color as null', () => {
    const r = createCategorySchema.parse({
      name: 'Pets',
      kind: 'expense',
      iconName: '',
      color: '',
    })
    expect(r.iconName).toBeNull()
    expect(r.color).toBeNull()
  })

  it('makes name optional on update (icon/color-only edit)', () => {
    const r = updateCategorySchema.safeParse({
      id: '11111111-1111-4111-8111-111111111111',
      iconName: 'Car',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.name).toBeUndefined()
    }
  })
})
