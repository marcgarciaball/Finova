/**
 * Category domain vocabulary (P1-03).
 *
 * A category has a `kind` — income or expense — and may be a top-level parent
 * or a subcategory (one level deep, enforced in the app layer). The kind is a
 * `text` + check column, mirroring `accounts.type`.
 */
export const CATEGORY_KINDS = ['income', 'expense'] as const

export type CategoryKind = (typeof CATEGORY_KINDS)[number]

export const isCategoryKind = (k: string): k is CategoryKind =>
  (CATEGORY_KINDS as readonly string[]).includes(k)
