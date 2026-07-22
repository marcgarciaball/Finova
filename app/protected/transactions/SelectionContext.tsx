'use client'

import type { TransactionFilters } from '@finova/domain/transactions/filters'
import {
  clearSelection,
  EMPTY_SELECTION,
  type HeaderCheckboxState,
  headerCheckboxState,
  isSelected as isSelectedFn,
  type SelectionState,
  selectAllFiltered,
  selectionCount,
  selectPage,
  toggleId,
} from '@finova/domain/transactions/selection'
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from 'react'

interface SelectionContextValue {
  clear: () => void
  count: number
  filters: TransactionFilters
  headerState: HeaderCheckboxState
  isSelected: (id: string) => boolean
  pageIds: string[]
  selectAllMatchingFilter: () => void
  state: SelectionState
  toggle: (id: string) => void
  toggleHeader: () => void
  totalFiltered: number
}

const SelectionContext = createContext<SelectionContextValue | null>(null)

export function SelectionProvider({
  pageIds,
  totalFiltered,
  filters,
  children,
}: {
  pageIds: string[]
  totalFiltered: number
  filters: TransactionFilters
  children: ReactNode
}) {
  const [state, setState] = useState<SelectionState>(EMPTY_SELECTION)

  const value = useMemo<SelectionContextValue>(() => {
    const header = headerCheckboxState(state, pageIds)
    return {
      state,
      pageIds,
      totalFiltered,
      filters,
      isSelected: (id: string) => isSelectedFn(state, id),
      toggle: (id: string) => setState((s) => toggleId(s, id)),
      toggleHeader: () =>
        setState(() =>
          header === 'unchecked' ? selectPage(pageIds) : clearSelection()
        ),
      selectAllMatchingFilter: () => setState(selectAllFiltered()),
      clear: () => setState(clearSelection()),
      count: selectionCount(state, totalFiltered),
      headerState: header,
    }
  }, [state, pageIds, totalFiltered, filters])

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  )
}

export function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext)
  if (!ctx) {
    throw new Error('useSelection must be used within a SelectionProvider')
  }
  return ctx
}
