// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseCsv } from '../csv'
import { revolutAdapter } from './revolut'

const fixture = (name: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)),
    'utf8'
  )

const parsed = parseCsv(fixture('revolut.csv'))

describe('revolutAdapter', () => {
  it('detects its own export', () => {
    expect(revolutAdapter.detect(parsed)).toBe(true)
  })

  it('does not detect a foreign export', () => {
    expect(revolutAdapter.detect(parseCsv(fixture('ing.csv')))).toBe(false)
  })

  it('takes the date from the ISO datetime and reads per-row currency', () => {
    const { rows, errors } = revolutAdapter.parse(parsed)
    expect(errors).toEqual([])
    expect(rows).toEqual([
      {
        occurredAt: '2026-06-23',
        amountCents: -350,
        description: 'Coffee Shop',
        currency: 'EUR',
      },
      {
        occurredAt: '2026-06-22',
        amountCents: 200000,
        description: 'Salary, June',
        currency: 'EUR',
      },
      {
        occurredAt: '2026-06-21',
        amountCents: -5000,
        description: 'Send to John',
        currency: 'USD',
      },
    ])
  })
})
