import { describe, expect, it } from 'vitest'
import type { ColumnMapping } from './mapping'
import {
  buildColumnMapping,
  emptyFormState,
  formStateFromMapping,
  type MappingFormState,
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
