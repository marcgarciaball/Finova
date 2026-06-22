import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORY_KEYS } from '@/lib/domain/categories/defaults'
import en from '@/messages/en.json'
import es from '@/messages/es.json'

/**
 * Every default category `name_key` must have a non-empty label in BOTH
 * locales — that is what makes the seeded set bilingual. This guards against
 * adding a default in defaults.ts (and the SQL seed) without translating it.
 */
describe('default category i18n coverage', () => {
  for (const key of DEFAULT_CATEGORY_KEYS) {
    it(`has en + es labels for "${key}"`, () => {
      const enLabel = (en.categories.defaults as Record<string, string>)[key]
      const esLabel = (es.categories.defaults as Record<string, string>)[key]
      expect(enLabel, `missing en label for ${key}`).toBeTruthy()
      expect(esLabel, `missing es label for ${key}`).toBeTruthy()
    })
  }
})
