import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORY_KEYS } from '@/lib/domain/categories/defaults'
import { DEFAULT_RULES } from '@/lib/domain/rules/defaults'
import { selectCategory } from '@/lib/domain/rules/match'
import type { Rule } from '@/lib/domain/rules/types'
import { conditionsSchema } from '@/lib/validation/categorization-rule'
import en from '@/messages/en.json'
import es from '@/messages/es.json'

/** The default rules as the domain matcher would see them (post-seed). */
const asRules: Rule[] = DEFAULT_RULES.map((d) => ({
  id: d.key,
  categoryId: d.categoryKey,
  conditions: [{ field: 'description', op: 'contains', value: d.contains }],
  priority: d.priority,
  enabled: true,
}))

describe('DEFAULT_RULES integrity', () => {
  it('every rule targets a known default category', () => {
    for (const rule of DEFAULT_RULES) {
      expect(
        DEFAULT_CATEGORY_KEYS,
        `unknown categoryKey "${rule.categoryKey}" on rule "${rule.key}"`
      ).toContain(rule.categoryKey)
    }
  })

  it('every rule has valid conditions', () => {
    for (const rule of DEFAULT_RULES) {
      const result = conditionsSchema.safeParse([
        { field: 'description', op: 'contains', value: rule.contains },
      ])
      expect(result.success, `invalid conditions for "${rule.key}"`).toBe(true)
    }
  })

  it('keys are unique', () => {
    const keys = DEFAULT_RULES.map((r) => r.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('priorities are unique (deterministic precedence)', () => {
    const priorities = DEFAULT_RULES.map((r) => r.priority)
    expect(new Set(priorities).size).toBe(priorities.length)
  })

  it('defaults sit at priority >= 100 so user rules (default 0) win', () => {
    for (const rule of DEFAULT_RULES) {
      expect(rule.priority).toBeGreaterThanOrEqual(100)
    }
  })
})

describe('DEFAULT_RULES matching behavior', () => {
  const match = (description: string) =>
    selectCategory(asRules, {
      description,
      amountCents: -1000,
      accountId: 'acct',
    })

  it('routes a grocery merchant to groceries', () => {
    expect(match('COMPRA MERCADONA BARCELONA')).toBe('groceries')
  })

  it('routes "uber eats" to restaurants, not transport', () => {
    expect(match('UBER EATS madrid')).toBe('restaurants')
  })

  it('routes a plain "uber" trip to transport', () => {
    expect(match('UBER *TRIP help.uber.com')).toBe('transport')
  })

  it('leaves an unknown merchant uncategorized', () => {
    expect(match('SOME LOCAL SHOP 1234')).toBeNull()
  })
})

describe('DEFAULT_RULES i18n coverage', () => {
  for (const rule of DEFAULT_RULES) {
    it(`has en + es labels for "${rule.key}"`, () => {
      const enLabel = (en.rules.defaults as Record<string, string>)[rule.key]
      const esLabel = (es.rules.defaults as Record<string, string>)[rule.key]
      expect(enLabel, `missing en label for ${rule.key}`).toBeTruthy()
      expect(esLabel, `missing es label for ${rule.key}`).toBeTruthy()
    })
  }
})
