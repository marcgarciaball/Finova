// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseCsv } from '../csv'
import { ingAdapter } from './ing'

const fixture = (name: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)),
    'utf8'
  )

const parsedIng = parseCsv(fixture('ing.csv'))

describe('ingAdapter', () => {
  it('detects its own export', () => {
    expect(ingAdapter.detect(parsedIng)).toBe(true)
  })

  it('does not detect a foreign export', () => {
    expect(ingAdapter.detect(parseCsv(fixture('revolut.csv')))).toBe(false)
  })

  it('parses signed cents, ISO dates, and descriptions', () => {
    const { rows } = ingAdapter.parse(parsedIng)
    expect(rows).toEqual([
      {
        occurredAt: '2026-06-23',
        amountCents: 150000,
        description: 'Nomina junio',
      },
      {
        occurredAt: '2026-06-22',
        amountCents: -4530,
        description: 'Mercadona; centro',
      },
      {
        occurredAt: '2026-06-21',
        amountCents: -450,
        description: 'Cafe del puerto',
      },
    ])
  })

  it('surfaces a malformed amount as a RowError, not a crash', () => {
    const { errors } = ingAdapter.parse(parsedIng)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ field: 'amount', rowIndex: 3 })
  })
})
