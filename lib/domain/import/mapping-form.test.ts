import { describe, expect, it } from 'vitest'
import type { ColumnMapping } from './mapping'
import {
  buildColumnMapping,
  emptyFormState,
  formStateFromMapping,
  type MappingFormState,
  suggestMapping,
} from './mapping-form'

const base = (over: Partial<MappingFormState> = {}): MappingFormState => ({
  ...emptyFormState(),
  dateColumn: 'Date',
  singleColumn: 'Amount',
  descriptionColumn: 'Concept',
  ...over,
})

describe('buildColumnMapping', () => {
  it('builds a single signed-column mapping', () => {
    const m = buildColumnMapping(base({ negativeIs: 'expense' }))
    expect(m.amount).toEqual({
      kind: 'single',
      column: 'Amount',
      negativeIs: 'expense',
    })
    expect(m.date).toEqual({ column: 'Date', format: 'auto' })
    expect(m.description).toEqual({ column: 'Concept' })
    expect(m.note).toBeUndefined()
    expect(m.currency).toBeUndefined()
  })

  it('includes the decimal hint only when set', () => {
    expect(buildColumnMapping(base({ decimal: ',' })).amount).toMatchObject({
      decimal: ',',
    })
    expect('decimal' in buildColumnMapping(base({ decimal: '' })).amount).toBe(
      false
    )
  })

  it('builds a debit/credit mapping', () => {
    const m = buildColumnMapping(
      base({
        amountKind: 'debitCredit',
        debitColumn: 'Debit',
        creditColumn: 'Credit',
      })
    )
    expect(m.amount).toEqual({
      kind: 'debitCredit',
      debitColumn: 'Debit',
      creditColumn: 'Credit',
    })
  })

  it('maps a note column only when chosen', () => {
    expect(buildColumnMapping(base({ noteColumn: 'Memo' })).note).toEqual({
      column: 'Memo',
    })
    expect(buildColumnMapping(base({ noteColumn: '  ' })).note).toBeUndefined()
  })

  it('maps currency from a column or a fixed code (upper-cased)', () => {
    expect(
      buildColumnMapping(
        base({ currencyMode: 'column', currencyColumn: 'Ccy' })
      ).currency
    ).toEqual({ column: 'Ccy' })
    expect(
      buildColumnMapping(base({ currencyMode: 'fixed', currencyFixed: 'eur' }))
        .currency
    ).toEqual({ fixed: 'EUR' })
    expect(
      buildColumnMapping(base({ currencyMode: 'none' })).currency
    ).toBeUndefined()
  })

  it('trims column names', () => {
    const m = buildColumnMapping(base({ dateColumn: '  Date  ' }))
    expect(m.date.column).toBe('Date')
  })
})

describe('formStateFromMapping (round-trips with build)', () => {
  const mappings: ColumnMapping[] = [
    {
      date: { column: 'Date', format: 'dmy' },
      amount: {
        kind: 'single',
        column: 'Amount',
        negativeIs: 'income',
        decimal: ',',
      },
      description: { column: 'Concept' },
    },
    {
      date: { column: 'Fecha', format: 'auto' },
      amount: {
        kind: 'debitCredit',
        debitColumn: 'Cargo',
        creditColumn: 'Abono',
      },
      description: { column: 'Detalle' },
      note: { column: 'Obs' },
      currency: { column: 'Divisa' },
    },
    {
      date: { column: 'D', format: 'ymd' },
      amount: { kind: 'single', column: 'A', negativeIs: 'expense' },
      description: { column: 'C' },
      currency: { fixed: 'USD' },
    },
  ]

  it.each(mappings)('build(formStateFromMapping(m)) === m', (m) => {
    expect(buildColumnMapping(formStateFromMapping(m))).toEqual(m)
  })
})

describe('suggestMapping', () => {
  it('maps a simple EN single-amount header set', () => {
    const s = suggestMapping(['Date', 'Description', 'Amount'])
    expect(s.dateColumn).toBe('Date')
    expect(s.descriptionColumn).toBe('Description')
    expect(s.amountKind).toBe('single')
    expect(s.singleColumn).toBe('Amount')
    expect(s.currencyMode).toBe('none')
  })

  it('maps an ES single-amount statement (ignores Saldo)', () => {
    const s = suggestMapping(['Fecha', 'Concepto', 'Importe', 'Saldo'])
    expect(s.dateColumn).toBe('Fecha')
    expect(s.descriptionColumn).toBe('Concepto')
    expect(s.amountKind).toBe('single')
    expect(s.singleColumn).toBe('Importe')
  })

  it('switches to debit/credit when both columns are present', () => {
    const s = suggestMapping(['Fecha', 'Concepto', 'Cargo', 'Abono', 'Saldo'])
    expect(s.amountKind).toBe('debitCredit')
    expect(s.debitColumn).toBe('Cargo')
    expect(s.creditColumn).toBe('Abono')
    expect(s.singleColumn).toBe('')
  })

  it('prefers "Completed Date" over "Started Date" and maps a currency column', () => {
    const s = suggestMapping([
      'Type',
      'Started Date',
      'Completed Date',
      'Description',
      'Amount',
      'Currency',
      'Balance',
    ])
    expect(s.dateColumn).toBe('Completed Date')
    expect(s.amountKind).toBe('single')
    expect(s.singleColumn).toBe('Amount')
    expect(s.currencyMode).toBe('column')
    expect(s.currencyColumn).toBe('Currency')
  })

  it('leaves unknown headers blank', () => {
    const s = suggestMapping(['Col1', 'Col2', 'Col3'])
    expect(s.dateColumn).toBe('')
    expect(s.descriptionColumn).toBe('')
    expect(s.singleColumn).toBe('')
  })
})
