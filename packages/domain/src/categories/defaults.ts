import type { CategoryKind } from './types'

/**
 * Canonical bilingual default category tree (P1-03).
 *
 * This is the single source of truth for the seeded set: it drives the i18n
 * keys (`categories.defaults.<key>`), the unit tests, and mirrors exactly what
 * `public.seed_default_categories()` inserts in migration `0002_categories`.
 * If you change this list, update the SQL seed and the message catalogs to
 * match (a test asserts every key has an `en`/`es` string).
 *
 * `key` is the stable `name_key` stored on the row. `en` is the literal `name`
 * fallback persisted alongside it. Children are subcategories that inherit the
 * parent's `kind`.
 */
export interface DefaultCategory {
  children?: { key: string; en: string }[]
  en: string
  key: string
  kind: CategoryKind
}

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  // — Expense —
  {
    key: 'housing',
    en: 'Housing',
    kind: 'expense',
    children: [
      { key: 'rent', en: 'Rent' },
      { key: 'mortgage', en: 'Mortgage' },
    ],
  },
  {
    key: 'food',
    en: 'Food & Dining',
    kind: 'expense',
    children: [
      { key: 'groceries', en: 'Groceries' },
      { key: 'restaurants', en: 'Restaurants' },
    ],
  },
  { key: 'transport', en: 'Transport', kind: 'expense' },
  { key: 'utilities', en: 'Utilities', kind: 'expense' },
  { key: 'health', en: 'Health', kind: 'expense' },
  { key: 'shopping', en: 'Shopping', kind: 'expense' },
  { key: 'entertainment', en: 'Entertainment', kind: 'expense' },
  { key: 'education', en: 'Education', kind: 'expense' },
  { key: 'travel', en: 'Travel', kind: 'expense' },
  { key: 'other_expense', en: 'Other', kind: 'expense' },
  // — Income —
  { key: 'salary', en: 'Salary', kind: 'income' },
  { key: 'gifts', en: 'Gifts', kind: 'income' },
  { key: 'other_income', en: 'Other income', kind: 'income' },
] as const

/** Every default `name_key`, parents and children, flattened. */
export const DEFAULT_CATEGORY_KEYS: readonly string[] =
  DEFAULT_CATEGORIES.flatMap((c) => [
    c.key,
    ...(c.children?.map((s) => s.key) ?? []),
  ])
