import { describe, expect, it } from 'vitest'
import type { ParsedCsv } from '../csv'
import type { ColumnMapping } from '../mapping'
import { defineMappingAdapter } from './define-mapping-adapter'

const mapping: ColumnMapping = {
  amount: {
    kind: 'single',
    column: 'Importe',
    negativeIs: 'expense',
    decimal: ',',
  },
  date: { column: 'Fecha', format: 'dmy' },
  description: { column: 'Concepto' },
}

const adapter = defineMappingAdapter({
  id: 'test-bank',
  signatureHeaders: ['Fecha', 'Concepto', 'Importe'],
  mapping,
})

const csv = (headers: string[], rows: string[][] = []): ParsedCsv => ({
  headers,
  rows,
})

describe('defineMappingAdapter detect', () => {
  it('matches when every signature header is present', () => {
    expect(adapter.detect(csv(['Fecha', 'Concepto', 'Importe']))).toBe(true)
  })
  it('is order-tolerant and accepts extra columns', () => {
    expect(adapter.detect(csv(['Saldo', 'Importe', 'Concepto', 'Fecha']))).toBe(
      true
    )
  })
  it('ignores case and accents', () => {
    expect(adapter.detect(csv(['FECHA', 'concepto', 'ImPorte']))).toBe(true)
  })
  it('is false when a signature header is missing', () => {
    expect(adapter.detect(csv(['Fecha', 'Concepto']))).toBe(false)
  })
})

describe('defineMappingAdapter parse', () => {
  it('maps rows to RawTxn via applyMapping', () => {
    const parsed = csv(
      ['Fecha', 'Concepto', 'Importe'],
      [['23/06/2026', 'Cafe', '-4,50']]
    )
    expect(adapter.parse(parsed)).toEqual({
      rows: [
        { occurredAt: '2026-06-23', amountCents: -450, description: 'Cafe' },
      ],
      errors: [],
    })
  })
  it('surfaces a malformed row as a RowError without dropping valid rows', () => {
    const parsed = csv(
      ['Fecha', 'Concepto', 'Importe'],
      [
        ['23/06/2026', 'Cafe', '-4,50'],
        ['not-a-date', 'Bad', '10,00'],
      ]
    )
    const result = adapter.parse(parsed)
    expect(result.rows).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.field).toBe('date')
  })
})
