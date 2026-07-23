// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseCsv } from '../csv'
import { bbvaAdapter } from './bbva'

const fixture = (name: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)),
    'utf8'
  )

// BBVA carries a preamble line above the header, so parseCsv treats the
// preamble as the (bogus) header row and the real header lands in `rows`.
const parsed = parseCsv(fixture('bbva.csv'))

describe('bbvaAdapter', () => {
  it('detects its export despite the preamble line above the header', () => {
    expect(bbvaAdapter.detect(parsed)).toBe(true)
  })

  it('does not detect a foreign export', () => {
    expect(bbvaAdapter.detect(parseCsv(fixture('caixabank.csv')))).toBe(false)
  })

  it('skips the preamble, re-keys the real header, and normalizes rows', () => {
    const { rows, errors } = bbvaAdapter.parse(parsed)
    expect(errors).toEqual([])
    expect(rows).toEqual([
      {
        occurredAt: '2026-06-23',
        amountCents: 120000,
        description: 'Transferencia recibida',
        currency: 'EUR',
      },
      {
        occurredAt: '2026-06-22',
        amountCents: -8999,
        description: 'Compra online; tienda',
        currency: 'EUR',
      },
      {
        occurredAt: '2026-06-21',
        amountCents: -1500,
        description: 'Pago con tarjeta',
        currency: 'USD',
      },
    ])
  })
})
