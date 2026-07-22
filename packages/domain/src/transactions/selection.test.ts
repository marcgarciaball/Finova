import { describe, expect, it } from 'vitest'
import {
  clearSelection,
  EMPTY_SELECTION,
  headerCheckboxState,
  isSelected,
  selectAllFiltered,
  selectionCount,
  selectPage,
  toggleId,
} from './selection'

describe('selectPage', () => {
  it('selects exactly the given ids in ids mode', () => {
    const state = selectPage(['a', 'b'])
    expect(state).toEqual({ mode: 'ids', ids: new Set(['a', 'b']) })
  })
})

describe('selectAllFiltered', () => {
  it('switches to all-filtered mode with no exclusions', () => {
    expect(selectAllFiltered()).toEqual({
      mode: 'all-filtered',
      excludedIds: new Set(),
    })
  })
})

describe('clearSelection', () => {
  it('returns the empty selection', () => {
    expect(clearSelection()).toBe(EMPTY_SELECTION)
  })
})

describe('toggleId', () => {
  it('starts a new ids-mode selection from none', () => {
    expect(toggleId(EMPTY_SELECTION, 'a')).toEqual({
      mode: 'ids',
      ids: new Set(['a']),
    })
  })

  it('adds an id within ids mode', () => {
    const state = selectPage(['a'])
    expect(toggleId(state, 'b')).toEqual({
      mode: 'ids',
      ids: new Set(['a', 'b']),
    })
  })

  it('removes an id within ids mode', () => {
    const state = selectPage(['a', 'b'])
    expect(toggleId(state, 'a')).toEqual({ mode: 'ids', ids: new Set(['b']) })
  })

  it('collapses to none when the last id is removed', () => {
    const state = selectPage(['a'])
    expect(toggleId(state, 'a')).toEqual(EMPTY_SELECTION)
  })

  it('excludes an id within all-filtered mode', () => {
    const state = selectAllFiltered()
    expect(toggleId(state, 'a')).toEqual({
      mode: 'all-filtered',
      excludedIds: new Set(['a']),
    })
  })

  it('re-includes a previously excluded id within all-filtered mode', () => {
    const state = toggleId(selectAllFiltered(), 'a')
    expect(toggleId(state, 'a')).toEqual({
      mode: 'all-filtered',
      excludedIds: new Set(),
    })
  })
})

describe('isSelected', () => {
  it('is false for every id when mode is none', () => {
    expect(isSelected(EMPTY_SELECTION, 'a')).toBe(false)
  })

  it('checks membership in ids mode', () => {
    const state = selectPage(['a'])
    expect(isSelected(state, 'a')).toBe(true)
    expect(isSelected(state, 'b')).toBe(false)
  })

  it('is true unless excluded in all-filtered mode', () => {
    const state = toggleId(selectAllFiltered(), 'a')
    expect(isSelected(state, 'a')).toBe(false)
    expect(isSelected(state, 'b')).toBe(true)
  })
})

describe('selectionCount', () => {
  it('is 0 when mode is none', () => {
    expect(selectionCount(EMPTY_SELECTION, 342)).toBe(0)
  })

  it('is the ids set size in ids mode', () => {
    expect(selectionCount(selectPage(['a', 'b', 'c']), 342)).toBe(3)
  })

  it('is total minus exclusions in all-filtered mode', () => {
    const state = toggleId(toggleId(selectAllFiltered(), 'a'), 'b')
    expect(selectionCount(state, 342)).toBe(340)
  })
})

describe('headerCheckboxState', () => {
  it('is unchecked when the page is empty', () => {
    expect(headerCheckboxState(EMPTY_SELECTION, [])).toBe('unchecked')
  })

  it('is unchecked when nothing on the page is selected', () => {
    expect(headerCheckboxState(EMPTY_SELECTION, ['a', 'b'])).toBe('unchecked')
  })

  it('is checked when every id on the page is selected', () => {
    expect(headerCheckboxState(selectPage(['a', 'b']), ['a', 'b'])).toBe(
      'checked'
    )
  })

  it('is indeterminate when only some of the page is selected', () => {
    expect(headerCheckboxState(selectPage(['a']), ['a', 'b'])).toBe(
      'indeterminate'
    )
  })

  it('is checked in all-filtered mode with no exclusions on the page', () => {
    expect(headerCheckboxState(selectAllFiltered(), ['a', 'b'])).toBe('checked')
  })

  it('is indeterminate in all-filtered mode with a partial page exclusion', () => {
    const state = toggleId(selectAllFiltered(), 'a')
    expect(headerCheckboxState(state, ['a', 'b'])).toBe('indeterminate')
  })
})
