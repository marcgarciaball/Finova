/**
 * Pure selection-state helpers for bulk-deleting transactions. No I/O, no
 * React — a `SelectionState` is either explicit row ids or "every row
 * matching the current filter minus a few explicitly excluded", so a giant
 * filtered set never needs to be materialized as an id list client-side.
 */

export type SelectionState =
  | { mode: 'none' }
  | { mode: 'ids'; ids: ReadonlySet<string> }
  | { mode: 'all-filtered'; excludedIds: ReadonlySet<string> }

export const EMPTY_SELECTION: SelectionState = { mode: 'none' }

/** Select every id on the current page (explicit ids mode). */
export function selectPage(pageIds: readonly string[]): SelectionState {
  return { mode: 'ids', ids: new Set(pageIds) }
}

/** Select every row matching the active filter, across all pages. */
export function selectAllFiltered(): SelectionState {
  return { mode: 'all-filtered', excludedIds: new Set() }
}

export function clearSelection(): SelectionState {
  return EMPTY_SELECTION
}

/** Toggle one row's selection, regardless of the current mode. */
export function toggleId(state: SelectionState, id: string): SelectionState {
  if (state.mode === 'none') {
    return { mode: 'ids', ids: new Set([id]) }
  }
  if (state.mode === 'ids') {
    const ids = new Set(state.ids)
    if (ids.has(id)) {
      ids.delete(id)
    } else {
      ids.add(id)
    }
    return ids.size === 0 ? EMPTY_SELECTION : { mode: 'ids', ids }
  }
  const excludedIds = new Set(state.excludedIds)
  if (excludedIds.has(id)) {
    excludedIds.delete(id)
  } else {
    excludedIds.add(id)
  }
  return { mode: 'all-filtered', excludedIds }
}

export function isSelected(state: SelectionState, id: string): boolean {
  switch (state.mode) {
    case 'none':
      return false
    case 'ids':
      return state.ids.has(id)
    case 'all-filtered':
      return !state.excludedIds.has(id)
  }
}

/** Total rows currently selected, given how many rows match the active filter. */
export function selectionCount(
  state: SelectionState,
  totalMatchingFilter: number
): number {
  switch (state.mode) {
    case 'none':
      return 0
    case 'ids':
      return state.ids.size
    case 'all-filtered':
      return totalMatchingFilter - state.excludedIds.size
  }
}

export type HeaderCheckboxState = 'checked' | 'unchecked' | 'indeterminate'

/** Tri-state for the "select all on this page" header checkbox. */
export function headerCheckboxState(
  state: SelectionState,
  pageIds: readonly string[]
): HeaderCheckboxState {
  if (pageIds.length === 0) {
    return 'unchecked'
  }
  const selectedCount = pageIds.filter((id) => isSelected(state, id)).length
  if (selectedCount === 0) {
    return 'unchecked'
  }
  if (selectedCount === pageIds.length) {
    return 'checked'
  }
  return 'indeterminate'
}
