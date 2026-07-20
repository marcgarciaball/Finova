import { describe, expect, it } from 'vitest'
import { categoryLabel } from './label'

describe('categoryLabel', () => {
  const t = (key: string) => `translated:${key}`

  it('translates default categories via their name_key', () => {
    expect(categoryLabel({ name: 'Housing', name_key: 'housing' }, t)).toBe(
      'translated:housing'
    )
  })

  it('uses the literal name for custom categories', () => {
    expect(categoryLabel({ name: 'Side hustle', name_key: null }, t)).toBe(
      'Side hustle'
    )
  })
})
