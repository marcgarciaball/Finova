import { describe, expect, it } from 'vitest'
import { createCategorizationRuleSchema } from '@/lib/validation/categorization-rule'
import { suggestRuleFromCorrection, suggestRuleToken } from './suggest'

const CATEGORY_ID = '11111111-1111-4111-8111-111111111111'

describe('suggestRuleToken', () => {
  it('strips a leading banking prefix and picks the merchant word', () => {
    expect(suggestRuleToken('COMPRA MERCADONA BARCELONA 1234')).toBe(
      'mercadona'
    )
  })

  it('skips pure-number and too-short tokens', () => {
    expect(suggestRuleToken('PAGO 0123 EL CORTE INGLES')).toBe('corte')
  })

  it('folds accents and case', () => {
    expect(suggestRuleToken('Día Supermercado')).toBe('dia')
  })

  it('falls back to the normalized string when every token is noise', () => {
    // All tokens are banking stopwords → never produce an empty token.
    expect(suggestRuleToken('PAGO TARJETA')).toBe('pago tarjeta')
  })

  it('never returns an empty token for a blank description', () => {
    expect(suggestRuleToken('   ')).toBe('')
  })

  it('skips the "tarj" card abbreviation and masked card numbers', () => {
    expect(
      suggestRuleToken('COMPRA TARJ. 5402XXXXXXXX7019 MY MERCAT JALON-XALO')
    ).toBe('mercat')
  })
})

describe('suggestRuleFromCorrection', () => {
  it('builds a valid, user-priority rule with a single contains clause', () => {
    const suggestion = suggestRuleFromCorrection({
      description: 'COMPRA MERCADONA BARCELONA',
      categoryId: CATEGORY_ID,
    })
    expect(suggestion.priority).toBe(0)
    expect(suggestion.conditions).toEqual([
      { field: 'description', op: 'contains', value: 'mercadona' },
    ])
    // The output must be persistable as-is.
    expect(createCategorizationRuleSchema.safeParse(suggestion).success).toBe(
      true
    )
  })

  it('title-cases the token into a default name', () => {
    expect(
      suggestRuleFromCorrection({
        description: 'GLOVO APP',
        categoryId: CATEGORY_ID,
      }).name
    ).toBe('Glovo')
  })

  it('honors a caller-supplied name', () => {
    expect(
      suggestRuleFromCorrection({
        description: 'GLOVO APP',
        categoryId: CATEGORY_ID,
        name: 'Food delivery',
      }).name
    ).toBe('Food delivery')
  })
})
