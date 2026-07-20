import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORY_KEYS } from '@/lib/domain/categories/defaults'
import { DEFAULT_CATEGORY_ICONS } from '@/lib/domain/categories/icons'

describe('DEFAULT_CATEGORY_ICONS', () => {
  it('has an icon + color for every default category key', () => {
    for (const key of DEFAULT_CATEGORY_KEYS) {
      const entry = DEFAULT_CATEGORY_ICONS[key]
      expect(entry, `missing icon entry for "${key}"`).toBeTruthy()
      expect(entry.iconName).toBeTruthy()
      expect(entry.color).toMatch(/^var\(--cat-\w+\)$/)
    }
  })

  it('has no extra entries beyond the default category keys', () => {
    expect(Object.keys(DEFAULT_CATEGORY_ICONS).sort()).toEqual(
      [...DEFAULT_CATEGORY_KEYS].sort()
    )
  })

  it('gives housing subcategories the Home icon, matching their parent', () => {
    expect(DEFAULT_CATEGORY_ICONS.rent.iconName).toBe('Home')
    expect(DEFAULT_CATEGORY_ICONS.mortgage.iconName).toBe('Home')
    expect(DEFAULT_CATEGORY_ICONS.rent.color).toBe(
      DEFAULT_CATEGORY_ICONS.housing.color
    )
  })

  it('gives food subcategories their own distinct icons', () => {
    expect(DEFAULT_CATEGORY_ICONS.groceries.iconName).toBe('ShoppingCart')
    expect(DEFAULT_CATEGORY_ICONS.restaurants.iconName).toBe('UtensilsCrossed')
  })
})
