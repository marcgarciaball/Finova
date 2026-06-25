import { describe, expect, it } from 'vitest'
import {
  columnMappingSchema,
  saveTemplateSchema,
} from '@/lib/validation/import-template'

const singleMapping = {
  date: { column: 'Date', format: 'dmy' },
  amount: { kind: 'single', column: 'Amount', negativeIs: 'expense' },
  description: { column: 'Desc' },
}

describe('columnMappingSchema', () => {
  it('accepts a minimal single-amount mapping', () => {
    expect(columnMappingSchema.safeParse(singleMapping).success).toBe(true)
  })

  it('accepts a debit/credit mapping with optional note + fixed currency', () => {
    const m = {
      date: { column: 'F', format: 'auto' },
      amount: {
        kind: 'debitCredit',
        debitColumn: 'Debit',
        creditColumn: 'Credit',
        decimal: ',',
      },
      description: { column: 'Concept' },
      note: { column: 'Memo' },
      currency: { fixed: 'EUR' },
    }
    expect(columnMappingSchema.safeParse(m).success).toBe(true)
  })

  it('accepts a column-based currency mapping', () => {
    const m = { ...singleMapping, currency: { column: 'Ccy' } }
    expect(columnMappingSchema.safeParse(m).success).toBe(true)
  })

  it('rejects an unknown amount kind', () => {
    const m = { ...singleMapping, amount: { kind: 'wat', column: 'A' } }
    expect(columnMappingSchema.safeParse(m).success).toBe(false)
  })

  it('rejects a single amount without negativeIs', () => {
    const m = { ...singleMapping, amount: { kind: 'single', column: 'A' } }
    expect(columnMappingSchema.safeParse(m).success).toBe(false)
  })

  it('rejects an invalid date format', () => {
    const m = { ...singleMapping, date: { column: 'D', format: 'qmy' } }
    expect(columnMappingSchema.safeParse(m).success).toBe(false)
  })

  it('rejects a missing required field (description)', () => {
    const { description, ...rest } = singleMapping
    expect(columnMappingSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects an empty column name', () => {
    const m = { ...singleMapping, description: { column: '' } }
    expect(columnMappingSchema.safeParse(m).success).toBe(false)
  })

  it('rejects an invalid fixed currency', () => {
    const m = { ...singleMapping, currency: { fixed: 'eur' } }
    expect(columnMappingSchema.safeParse(m).success).toBe(false)
  })

  it('strips unknown keys from the mapping object', () => {
    const m = { ...singleMapping, evil: 'x' }
    const parsed = columnMappingSchema.parse(m)
    expect('evil' in parsed).toBe(false)
  })
})

describe('saveTemplateSchema', () => {
  it('accepts a valid template', () => {
    const r = saveTemplateSchema.safeParse({
      name: 'My Bank',
      signature: 'deadbeef',
      mapping: singleMapping,
    })
    expect(r.success).toBe(true)
  })

  it('trims and rejects an empty name', () => {
    const r = saveTemplateSchema.safeParse({
      name: '   ',
      signature: 'deadbeef',
      mapping: singleMapping,
    })
    expect(r.success).toBe(false)
  })

  it('rejects a name over 100 chars', () => {
    const r = saveTemplateSchema.safeParse({
      name: 'x'.repeat(101),
      signature: 'deadbeef',
      mapping: singleMapping,
    })
    expect(r.success).toBe(false)
  })

  it('rejects a missing signature', () => {
    const r = saveTemplateSchema.safeParse({
      name: 'My Bank',
      mapping: singleMapping,
    })
    expect(r.success).toBe(false)
  })

  it('rejects a malformed mapping', () => {
    const r = saveTemplateSchema.safeParse({
      name: 'My Bank',
      signature: 'deadbeef',
      mapping: { date: { column: 'D' } },
    })
    expect(r.success).toBe(false)
  })
})
