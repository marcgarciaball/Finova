import { describe, expect, it } from 'vitest'
import { BACKUP_SCHEMA_VERSION } from '../../export/bundle'
import { parseBackup } from './parse'

const property = () => ({
  id: 'pr1',
  user_id: 'u1',
  name: 'Piso',
  type: 'investment',
  address: null,
  city: null,
  country: 'ES',
  currency: 'EUR',
  purchase_date: '2020-01-15',
  purchase_price_cents: 12_000_000,
  purchase_fees_cents: 0,
  current_value_cents: 15_000_000,
  last_valued_at: '2026-01-01',
  ownership_pct: 100,
  is_rented: false,
  rental_start_date: null,
  rental_end_date: null,
  current_rent_cents: null,
  is_sold: false,
  sold_date: null,
  sold_price_cents: null,
  sold_fees_cents: null,
  notes: null,
  created_at: '2020-01-15T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
})

const validFile = (over: Record<string, unknown> = {}) => ({
  meta: {
    app: 'finova',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: '2026-07-15T00:00:00Z',
    domains: ['realEstate'],
  },
  realEstate: {
    properties: [property()],
    loans: [],
    valuations: [],
    income: [],
    expenses: [],
  },
  ...over,
})

describe('parseBackup', () => {
  it('accepts a well-formed real-estate backup', () => {
    const res = parseBackup(validFile())
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data.realEstate?.properties).toHaveLength(1)
      expect(res.data.meta.domains).toEqual(['realEstate'])
    }
  })

  it('rejects a non-object', () => {
    const res = parseBackup('nope')
    expect(res).toMatchObject({ ok: false, error: { code: 'malformed' } })
  })

  it('rejects a file from another app', () => {
    const res = parseBackup(
      validFile({
        meta: { app: 'other', schemaVersion: BACKUP_SCHEMA_VERSION },
      })
    )
    expect(res).toMatchObject({ ok: false, error: { code: 'notFinova' } })
  })

  it('rejects an unsupported schema version', () => {
    const res = parseBackup(
      validFile({ meta: { app: 'finova', schemaVersion: 999 } })
    )
    expect(res).toMatchObject({
      ok: false,
      error: { code: 'unsupportedVersion' },
    })
  })

  it('rejects a malformed domain payload', () => {
    const res = parseBackup(
      validFile({ realEstate: { properties: [{ bogus: true }] } })
    )
    expect(res).toMatchObject({ ok: false, error: { code: 'malformed' } })
  })

  it('parses meta with no domain bodies', () => {
    const res = parseBackup({
      meta: { app: 'finova', schemaVersion: BACKUP_SCHEMA_VERSION },
    })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data.realEstate).toBeUndefined()
  })
})
