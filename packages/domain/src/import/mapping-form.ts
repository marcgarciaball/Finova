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

/**
 * Heuristic auto-mapping from header names (P2-03 UX). When a file is parsed and
 * no saved template matches its layout, we pre-select the most likely date /
 * amount / description / currency columns by matching common ES + EN bank header
 * names — so the preview is populated immediately instead of erroring on an
 * unmapped date column. The user can still override every choice. Patterns are
 * ordered by specificity (first match wins per role); a debit + credit pair
 * switches the amount mode to two-column. Anything ambiguous is left blank.
 */
const DATE_PATTERNS = [
  /completed\s*date/i,
  /f\.?\s*valor/i,
  /fecha/i,
  /\bdate\b/i,
  /date/i,
]
const DESCRIPTION_PATTERNS = [
  /concepto/i,
  /descrip/i,
  /concept/i,
  /detalle/i,
  /memo/i,
]
const SINGLE_AMOUNT_PATTERNS = [/importe/i, /\bamount\b/i, /\bmonto\b/i]
const DEBIT_PATTERNS = [
  /cargo/i,
  /d[eé]bito/i,
  /\bdebe\b/i,
  /debit/i,
  /charge/i,
  /\bspent\b/i,
]
const CREDIT_PATTERNS = [
  /abono/i,
  /cr[eé]dito/i,
  /\bhaber\b/i,
  /credit/i,
  /deposit/i,
  /received/i,
]
const CURRENCY_PATTERNS = [/divisa/i, /currency/i, /moneda/i]

/** First header matching the highest-priority pattern, or '' if none match. */
function firstMatch(headers: string[], patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const hit = headers.find((h) => pattern.test(h))
    if (hit) return hit
  }
  return ''
}

/** Best-effort initial form state inferred from a file's headers. */
export function suggestMapping(headers: string[]): MappingFormState {
  const state = emptyFormState()
  state.dateColumn = firstMatch(headers, DATE_PATTERNS)
  state.descriptionColumn = firstMatch(headers, DESCRIPTION_PATTERNS)

  const debit = firstMatch(headers, DEBIT_PATTERNS)
  const credit = firstMatch(headers, CREDIT_PATTERNS)
  if (debit && credit) {
    state.amountKind = 'debitCredit'
    state.debitColumn = debit
    state.creditColumn = credit
  } else {
    state.amountKind = 'single'
    state.singleColumn = firstMatch(headers, SINGLE_AMOUNT_PATTERNS)
  }

  const currency = firstMatch(headers, CURRENCY_PATTERNS)
  if (currency) {
    state.currencyMode = 'column'
    state.currencyColumn = currency
  }
  return state
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
