/**
 * Form-state ↔ {@link ColumnMapping} conversion for the column-mapping UI
 * (P2-03). Pure: the React form holds a flat {@link MappingFormState}, and these
 * helpers build the structured `ColumnMapping` the engine/validation consume,
 * and pre-fill the form from a saved template's mapping. Kept out of the
 * component (and the `'use server'` action module) so it is unit-testable.
 */

import type { ColumnMapping, DateFormat } from './mapping'

export type AmountKind = 'single' | 'debitCredit'
export type CurrencyMode = 'none' | 'column' | 'fixed'
/** Empty string = "auto" (let the locale parser sniff the decimal separator). */
export type DecimalChoice = '' | ',' | '.'

export interface MappingFormState {
  amountKind: AmountKind
  creditColumn: string
  currencyColumn: string
  currencyFixed: string
  currencyMode: CurrencyMode
  dateColumn: string
  dateFormat: DateFormat
  debitColumn: string
  decimal: DecimalChoice
  descriptionColumn: string
  negativeIs: 'expense' | 'income'
  noteColumn: string
  singleColumn: string
}

/** A blank state; columns default to "" so the user must map them explicitly. */
export function emptyFormState(): MappingFormState {
  return {
    dateColumn: '',
    dateFormat: 'auto',
    amountKind: 'single',
    singleColumn: '',
    negativeIs: 'expense',
    debitColumn: '',
    creditColumn: '',
    decimal: '',
    descriptionColumn: '',
    noteColumn: '',
    currencyMode: 'none',
    currencyColumn: '',
    currencyFixed: '',
  }
}

/** Build the structured mapping the engine/validation consume from form state. */
export function buildColumnMapping(state: MappingFormState): ColumnMapping {
  const mapping: ColumnMapping = {
    date: { column: state.dateColumn.trim(), format: state.dateFormat },
    amount:
      state.amountKind === 'single'
        ? {
            kind: 'single',
            column: state.singleColumn.trim(),
            negativeIs: state.negativeIs,
            ...(state.decimal ? { decimal: state.decimal } : {}),
          }
        : {
            kind: 'debitCredit',
            debitColumn: state.debitColumn.trim(),
            creditColumn: state.creditColumn.trim(),
            ...(state.decimal ? { decimal: state.decimal } : {}),
          },
    description: { column: state.descriptionColumn.trim() },
  }
  if (state.noteColumn.trim() !== '') {
    mapping.note = { column: state.noteColumn.trim() }
  }
  if (state.currencyMode === 'column' && state.currencyColumn.trim() !== '') {
    mapping.currency = { column: state.currencyColumn.trim() }
  } else if (
    state.currencyMode === 'fixed' &&
    state.currencyFixed.trim() !== ''
  ) {
    mapping.currency = { fixed: state.currencyFixed.trim().toUpperCase() }
  }
  return mapping
}

/** Pre-fill the form from a saved template's mapping (reverse of build). */
export function formStateFromMapping(mapping: ColumnMapping): MappingFormState {
  const state = emptyFormState()
  state.dateColumn = mapping.date.column
  state.dateFormat = mapping.date.format ?? 'auto'

  if (mapping.amount.kind === 'single') {
    state.amountKind = 'single'
    state.singleColumn = mapping.amount.column
    state.negativeIs = mapping.amount.negativeIs
    state.decimal = mapping.amount.decimal ?? ''
  } else {
    state.amountKind = 'debitCredit'
    state.debitColumn = mapping.amount.debitColumn
    state.creditColumn = mapping.amount.creditColumn
    state.decimal = mapping.amount.decimal ?? ''
  }

  state.descriptionColumn = mapping.description.column
  state.noteColumn = mapping.note?.column ?? ''

  if (mapping.currency && 'column' in mapping.currency) {
    state.currencyMode = 'column'
    state.currencyColumn = mapping.currency.column
  } else if (mapping.currency && 'fixed' in mapping.currency) {
    state.currencyMode = 'fixed'
    state.currencyFixed = mapping.currency.fixed
  }
  return state
}
