import { describe, expect, it } from 'vitest'
import { buildCategoryTree } from '@/lib/domain/categories/tree'
import type { CategoryRow } from '@/lib/validation/category'

const row = (over: Partial<CategoryRow> & { id: string }): CategoryRow => ({
  user_id: 'u1',
  parent_id: null,
  name: over.id,
  name_key: null,
  kind: 'expense',
  is_default: false,
  icon_name: null,
  color: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
})

const labelOf = (r: CategoryRow): string => r.name

describe('buildCategoryTree', () => {
  it('nests children under their parent, sorted by label', () => {
    const rows = [
      row({ id: 'food', name: 'Food' }),
      row({ id: 'rent', name: 'Rent' }),
      row({ id: 'restaurants', name: 'Restaurants', parent_id: 'food' }),
      row({ id: 'groceries', name: 'Groceries', parent_id: 'food' }),
    ]
    const tree = buildCategoryTree(rows, labelOf)
    expect(tree.map((n) => n.id)).toEqual(['food', 'rent'])
    expect(tree[0]?.children.map((c) => c.id)).toEqual([
      'groceries',
      'restaurants',
    ])
  })

  it('drops orphans rather than promoting them to top level', () => {
    const rows = [
      row({ id: 'a', name: 'A' }),
      row({ id: 'orphan', name: 'Orphan', parent_id: 'missing' }),
    ]
    const tree = buildCategoryTree(rows, labelOf)
    expect(tree.map((n) => n.id)).toEqual(['a'])
  })

  it('returns empty for no rows', () => {
    expect(buildCategoryTree([], labelOf)).toEqual([])
  })
})
