// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseCsv } from '../csv'
import { createBankRegistry } from './index'

const fixture = (name: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)),
    'utf8'
  )

const registry = createBankRegistry()

describe('createBankRegistry routing', () => {
  it.each([
    ['ing.csv', 'ing'],
    ['bbva.csv', 'bbva'],
    ['revolut.csv', 'revolut'],
    ['caixabank.csv', 'caixabank'],
  ])('routes %s to the %s adapter', (file, id) => {
    expect(registry.select(parseCsv(fixture(file)))?.id).toBe(id)
  })

  it('falls back to null for an unrecognized header set', () => {
    const unknown = parseCsv('Col1,Col2,Col3\na,b,c\n')
    expect(registry.select(unknown)).toBeNull()
  })
})
