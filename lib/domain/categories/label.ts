/**
 * Resolve a category's display label (P1-05).
 *
 * Default (seeded) categories carry a stable `name_key` and are localized via
 * `categories.defaults.<name_key>`; user-created categories have a null
 * `name_key` and use their literal `name`. Pure: the caller passes a translator
 * (`t` bound to the `categories.defaults` namespace) so this stays React-free
 * and unit-testable.
 */
export function categoryLabel(
  category: { name: string; name_key: string | null },
  tDefaults: (key: string) => string
): string {
  if (category.name_key) {
    return tDefaults(category.name_key)
  }
  return category.name
}
