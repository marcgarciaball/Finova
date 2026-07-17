import type { CategoryRow } from '@/lib/validation/category'

/**
 * Assemble a flat category list into the two-level tree the management UI
 * renders (P5-01). Pure and framework-free so it is unit-testable.
 *
 * A parent is any row with `parent_id === null`; its children are the rows whose
 * `parent_id` points at it. Orphans (a child whose parent is missing from the
 * set — shouldn't happen under RLS, but be total) are dropped rather than
 * promoted, so the tree never invents a top-level node. `labelOf` resolves the
 * display label (default → i18n, custom → literal) so ordering matches what the
 * user reads; ties fall back to id for determinism.
 */
export interface CategoryTreeNode extends CategoryRow {
  children: CategoryRow[]
}

export function buildCategoryTree(
  rows: CategoryRow[],
  labelOf: (row: CategoryRow) => string
): CategoryTreeNode[] {
  const parents = rows.filter((r) => r.parent_id === null)
  const childrenByParent = new Map<string, CategoryRow[]>()
  for (const row of rows) {
    if (row.parent_id !== null) {
      const list = childrenByParent.get(row.parent_id) ?? []
      list.push(row)
      childrenByParent.set(row.parent_id, list)
    }
  }

  const byLabel = (a: CategoryRow, b: CategoryRow): number => {
    const cmp = labelOf(a).localeCompare(labelOf(b))
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id)
  }

  return parents.sort(byLabel).map((parent) => ({
    ...parent,
    children: (childrenByParent.get(parent.id) ?? []).sort(byLabel),
  }))
}
