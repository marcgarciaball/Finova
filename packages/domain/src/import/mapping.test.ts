import { describe, expect, it } from 'vitest'
import { applyMapping, type ColumnMapping, headerSignature } from './mapping'

const rec = (o: Record<string, string>) => o

describe('headerSignature', () => {
  it('is stable for the same headers', () => {
    const a = headerSignature(['Date', 'Amount', 'Description'])
    const b = headerSignature(['Date', 'Amount', 'Description'])
    expect(a).toBe(b)
  })

  it('normalizes trim, case, accents, and whitespace', () => {
    const a = headerSignature(['  Fecha ', 'Descripción', 'Importe'])
    const b = headerSignature(['fecha', 'descripcion', 'importe'])
    expect(a).toBe(b)
  })

  it('is sensitive to the header text', () => {
    expect(headerSignature(['Date', 'Amount'])).not.toBe(
      headerSignature(['Date', 'Total'])
    )
  })

  it('is order-sensitive (header order is part of layout identity)', () => {
    expect(headerSignature(['Date', 'Amount'])).not.toBe(
      headerSignature(['Amount', 'Date'])
    )
  })
})

describe('applyMapping — single signed amount column', () => {
  const mapping: ColumnMapping = {
    date: { column: 'Date', format: 'ymd' },
    amount: { kind: 'single', column: 'Amount', negativeIs: 'expense' },
    description: { column: 'Desc' },
  }

  it('keeps a negative source as a negative (expense) when negativeIs=expense', () => {
    const { rows, errors } = applyMapping(
      [rec({ Date: '2026-01-15', Amount: '-50.00', Desc: 'Groceries' })],
      mapping
    )
    expect(errors).toEqual([])
    expect(rows).toEqual([
      {
        amountCents: -5000,
        description: 'Groceries',
        occurredAt: '2026-01-15',
      },
    ])
  })

  it('keeps a positive source as income', () => {
    const { rows } = applyMapping(
      [rec({ Date: '2026-01-15', Amount: '1200.50', Desc: 'Salary' })],
      mapping
    )
    expect(rows[0]?.amountCents).toBe(120050)
  })

  it('inverts the sign when negativeIs=income', () => {
    const inverted: ColumnMapping = {
      ...mapping,
      amount: { kind: 'single', column: 'Amount', negativeIs: 'income' },
    }
    const { rows } = applyMapping(
      [rec({ Date: '2026-01-15', Amount: '-50.00', Desc: 'Refund' })],
      inverted
    )
    expect(rows[0]?.amountCents).toBe(5000)
  })

  it('parses a comma-decimal source with an explicit hint', () => {
    const esMapping: ColumnMapping = {
      ...mapping,
      amount: {
        kind: 'single',
        column: 'Amount',
        decimal: ',',
        negativeIs: 'expense',
      },
    }
    const { rows } = applyMapping(
      [rec({ Date: '2026-01-15', Amount: '1.234,56', Desc: 'Rent' })],
      esMapping
    )
    expect(rows[0]?.amountCents).toBe(123456)
  })

  it('flags a garbage amount as a RowError without aborting other rows', () => {
    const { rows, errors } = applyMapping(
      [
        rec({ Date: '2026-01-15', Amount: 'N/A', Desc: 'Bad' }),
        rec({ Date: '2026-01-16', Amount: '10.00', Desc: 'Good' }),
      ],
      mapping
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.description).toBe('Good')
    expect(errors).toEqual([
      { rowIndex: 0, field: 'amount', raw: 'N/A', reason: 'invalidAmount' },
    ])
  })
})

describe('applyMapping — debit/credit pair', () => {
  const mapping: ColumnMapping = {
    date: { column: 'Date', format: 'dmy' },
    amount: {
      kind: 'debitCredit',
      debitColumn: 'Debit',
      creditColumn: 'Credit',
    },
    description: { column: 'Desc' },
  }

  it('maps a debit to a negative (expense) amount', () => {
    const { rows } = applyMapping(
      [rec({ Date: '15/01/2026', Debit: '50.00', Credit: '', Desc: 'Shop' })],
      mapping
    )
    expect(rows[0]?.amountCents).toBe(-5000)
  })

  it('maps a credit to a positive (income) amount', () => {
    const { rows } = applyMapping(
      [rec({ Date: '15/01/2026', Debit: '', Credit: '99.00', Desc: 'Pay' })],
      mapping
    )
    expect(rows[0]?.amountCents).toBe(9900)
  })

  it('errors when both debit and credit are populated', () => {
    const { rows, errors } = applyMapping(
      [rec({ Date: '15/01/2026', Debit: '1.00', Credit: '2.00', Desc: 'X' })],
      mapping
    )
    expect(rows).toEqual([])
    expect(errors[0]).toMatchObject({ rowIndex: 0, field: 'amount' })
  })

  it('errors when both debit and credit are empty', () => {
    const { errors } = applyMapping(
      [rec({ Date: '15/01/2026', Debit: '', Credit: '', Desc: 'X' })],
      mapping
    )
    expect(errors[0]).toMatchObject({ rowIndex: 0, field: 'amount' })
  })
})

describe('applyMapping — date', () => {
  const base: ColumnMapping = {
    date: { column: 'Date', format: 'dmy' },
    amount: { kind: 'single', column: 'Amount', negativeIs: 'expense' },
    description: { column: 'Desc' },
  }

  it('parses a dmy date to ISO', () => {
    const { rows } = applyMapping(
      [rec({ Date: '02/03/2026', Amount: '1.00', Desc: 'X' })],
      base
    )
    expect(rows[0]?.occurredAt).toBe('2026-03-02')
  })

  it('flags an unparseable date as a RowError', () => {
    const { rows, errors } = applyMapping(
      [rec({ Date: 'not-a-date', Amount: '1.00', Desc: 'X' })],
      base
    )
    expect(rows).toEqual([])
    expect(errors[0]).toMatchObject({
      rowIndex: 0,
      field: 'date',
      raw: 'not-a-date',
    })
  })
})

describe('applyMapping — description, note, currency', () => {
  const base: ColumnMapping = {
    date: { column: 'Date', format: 'ymd' },
    amount: { kind: 'single', column: 'Amount', negativeIs: 'expense' },
    description: { column: 'Desc' },
  }

  it('errors on an empty description', () => {
    const { rows, errors } = applyMapping(
      [rec({ Date: '2026-01-15', Amount: '1.00', Desc: '   ' })],
      base
    )
    expect(rows).toEqual([])
    expect(errors[0]).toMatchObject({ rowIndex: 0, field: 'description' })
  })

  it('includes an optional note when mapped and present', () => {
    const m: ColumnMapping = { ...base, note: { column: 'Memo' } }
    const { rows } = applyMapping(
      [rec({ Date: '2026-01-15', Amount: '1.00', Desc: 'X', Memo: 'hello' })],
      m
    )
    expect(rows[0]?.note).toBe('hello')
  })

  it('omits the note when the mapped column is empty', () => {
    const m: ColumnMapping = { ...base, note: { column: 'Memo' } }
    const { rows } = applyMapping(
      [rec({ Date: '2026-01-15', Amount: '1.00', Desc: 'X', Memo: '' })],
      m
    )
    expect(rows[0]?.note).toBeUndefined()
  })

  it('applies a fixed currency', () => {
    const m: ColumnMapping = { ...base, currency: { fixed: 'EUR' } }
    const { rows } = applyMapping(
      [rec({ Date: '2026-01-15', Amount: '1.00', Desc: 'X' })],
      m
    )
    expect(rows[0]?.currency).toBe('EUR')
  })

  it('reads currency from a column', () => {
    const m: ColumnMapping = { ...base, currency: { column: 'Ccy' } }
    const { rows } = applyMapping(
      [rec({ Date: '2026-01-15', Amount: '1.00', Desc: 'X', Ccy: 'usd' })],
      m
    )
    expect(rows[0]?.currency).toBe('USD')
  })

  it('errors on a malformed currency value', () => {
    const m: ColumnMapping = { ...base, currency: { column: 'Ccy' } }
    const { errors } = applyMapping(
      [rec({ Date: '2026-01-15', Amount: '1.00', Desc: 'X', Ccy: 'dollars' })],
      m
    )
    expect(errors[0]).toMatchObject({ rowIndex: 0, field: 'currency' })
  })
})
