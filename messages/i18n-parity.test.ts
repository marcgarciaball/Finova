import { describe, expect, it } from 'vitest'
import en from '@/messages/en.json'
import es from '@/messages/es.json'

/**
 * The EN and ES catalogs must define exactly the same set of keys (P0-09 / the
 * running i18n pass culminates in P5-03). Missing a key in one locale is a
 * latent runtime error, so we assert structural parity here rather than at
 * render time. This walks the whole tree, so any new namespace is covered for
 * free.
 */
function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') {
    return [prefix]
  }
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flattenKeys(v, prefix ? `${prefix}.${k}` : k)
  )
}

describe('message catalog parity (en ⇄ es)', () => {
  const enKeys = new Set(flattenKeys(en))
  const esKeys = new Set(flattenKeys(es))

  it('has every EN key in ES', () => {
    const missing = [...enKeys].filter((k) => !esKeys.has(k))
    expect(missing, `missing in es: ${missing.join(', ')}`).toEqual([])
  })

  it('has every ES key in EN', () => {
    const missing = [...esKeys].filter((k) => !enKeys.has(k))
    expect(missing, `missing in en: ${missing.join(', ')}`).toEqual([])
  })
})
