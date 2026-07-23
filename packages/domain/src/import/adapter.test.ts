import { describe, expect, it } from 'vitest'
import {
  createAdapterRegistry,
  type ImportAdapter,
  type RawTxn,
  selectAdapter,
} from './adapter'
import type { ParsedCsv } from './csv'

const parsed = (headers: string[]): ParsedCsv => ({ headers, rows: [] })

/** A test adapter that matches when a marker header is present. */
function adapterFor(id: string, marker: string): ImportAdapter {
  return {
    id,
    detect: (p) => p.headers.includes(marker),
    parse: (): { rows: RawTxn[]; errors: [] } => ({
      rows: [{ occurredAt: '2026-06-23', amountCents: -1000, description: id }],
      errors: [],
    }),
  }
}

describe('selectAdapter', () => {
  it('returns the first adapter whose detect matches', () => {
    const a = adapterFor('a', 'Fecha')
    const b = adapterFor('b', 'Date')
    expect(selectAdapter([a, b], parsed(['Date', 'Amount']))).toBe(b)
  })

  it('respects registration order when more than one matches (priority)', () => {
    const first = adapterFor('first', 'Date')
    const second = adapterFor('second', 'Date')
    expect(selectAdapter([first, second], parsed(['Date']))).toBe(first)
  })

  it('returns null when no adapter recognizes the file', () => {
    const a = adapterFor('a', 'Fecha')
    expect(selectAdapter([a], parsed(['Date', 'Amount']))).toBeNull()
  })

  it('returns null for an empty adapter list', () => {
    expect(selectAdapter([], parsed(['Date']))).toBeNull()
  })
})

describe('createAdapterRegistry', () => {
  it('selects a registered adapter by detection', () => {
    const registry = createAdapterRegistry()
    const a = adapterFor('santander', 'Concepto')
    registry.register(a)
    expect(registry.select(parsed(['Concepto', 'Importe']))).toBe(a)
  })

  it('accepts initial adapters at construction', () => {
    const a = adapterFor('a', 'Fecha')
    const registry = createAdapterRegistry([a])
    expect(registry.list()).toEqual([a])
  })

  it('lists adapters in registration order without exposing the internal array', () => {
    const a = adapterFor('a', 'A')
    const b = adapterFor('b', 'B')
    const registry = createAdapterRegistry([a])
    registry.register(b)
    const list = registry.list()
    expect(list).toEqual([a, b])
    // Mutating the returned list must not affect the registry.
    list.pop()
    expect(registry.list()).toEqual([a, b])
  })

  it('rejects a duplicate adapter id', () => {
    const registry = createAdapterRegistry([adapterFor('dup', 'A')])
    expect(() => registry.register(adapterFor('dup', 'B'))).toThrow(
      /duplicate/i
    )
  })

  it('falls back to null so callers can use the generic mapping flow', () => {
    const registry = createAdapterRegistry([adapterFor('a', 'Fecha')])
    expect(registry.select(parsed(['unmapped']))).toBeNull()
  })
})
