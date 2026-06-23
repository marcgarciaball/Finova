// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseCsv } from '../csv'
import { caixabankAdapter } from './caixabank'

const fixture = (name: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)),
    'utf8'
  )

const parsed = parseCsv(fixture('caixabank.csv'))

describe('caixabankAdapter', () => {
  it('detects its own export', () => {
    expect(caixabankAdapter.detect(parsed)).toBe(true)
  })

  it('does not detect a foreign export', () => {
    expect(caixabankAdapter.detect(parseCsv(fixture('revolut.csv')))).toBe(
      false
    )
  })

  it('maps debit to expense and credit to income', () => {
    const { rows, errors } = caixabankAdapter.parse(parsed)
    expect(errors).toEqual([])
    expect(rows).toEqual([
      { occurredAt: '2026-06-23', amountCents: 150000, description: 'Nomina' },
      {
        occurredAt: '2026-06-22',
        amountCents: -4530,
        description: 'Compra; supermercado',
      },
      {
        occurredAt: '2026-06-21',
        amountCents: -300,
        description: 'Comision mantenimiento',
      },
    ])
  })
})
