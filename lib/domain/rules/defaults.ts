/**
 * Canonical default categorization rules (P3-04).
 *
 * Single source of truth for the seeded rule set: it drives the i18n keys
 * (`rules.defaults.<key>`), the tests, and mirrors exactly what
 * `public.seed_default_rules()` inserts in migration `0008`. If you change this
 * list, update the SQL seed and the message catalogs to match (tests assert
 * referential integrity against the default categories, valid conditions,
 * unique keys/priorities, and EN/ES label parity).
 *
 * Each rule is a single `description contains <token>` clause (the matcher is
 * case-insensitive); OR across merchants for one category is expressed as
 * multiple rules (the AND-only model). Priorities are explicit and distinct so
 * precedence is deterministic and a specific token outranks a generic one
 * (`uber eats` before `uber`). All defaults sit at priority ≥ 100 so any
 * user-authored rule (default priority 0) wins.
 */

export interface DefaultRule {
  /** Target category's `name_key` (must be in DEFAULT_CATEGORY_KEYS). */
  categoryKey: string
  /** Description substring to match (compared case-insensitively). */
  contains: string
  /** Literal `name` fallback persisted alongside `name_key`. */
  en: string
  /** Stable `name_key` on the row + i18n key (`rules.defaults.<key>`). */
  key: string
  /** Explicit, distinct; lower = higher precedence. */
  priority: number
}

export const DEFAULT_RULES: readonly DefaultRule[] = [
  // — Groceries (food → groceries) —
  {
    key: 'mercadona',
    en: 'Mercadona',
    categoryKey: 'groceries',
    contains: 'mercadona',
    priority: 100,
  },
  {
    key: 'carrefour',
    en: 'Carrefour',
    categoryKey: 'groceries',
    contains: 'carrefour',
    priority: 101,
  },
  {
    key: 'lidl',
    en: 'Lidl',
    categoryKey: 'groceries',
    contains: 'lidl',
    priority: 102,
  },
  {
    key: 'dia',
    en: 'Dia',
    categoryKey: 'groceries',
    contains: 'supermercado dia',
    priority: 103,
  },
  {
    key: 'aldi',
    en: 'Aldi',
    categoryKey: 'groceries',
    contains: 'aldi',
    priority: 104,
  },
  {
    key: 'consum',
    en: 'Consum',
    categoryKey: 'groceries',
    contains: 'consum',
    priority: 105,
  },
  {
    key: 'eroski',
    en: 'Eroski',
    categoryKey: 'groceries',
    contains: 'eroski',
    priority: 106,
  },
  // — Restaurants & food delivery (food → restaurants) — listed before `uber` —
  {
    key: 'glovo',
    en: 'Glovo',
    categoryKey: 'restaurants',
    contains: 'glovo',
    priority: 110,
  },
  {
    key: 'uber_eats',
    en: 'Uber Eats',
    categoryKey: 'restaurants',
    contains: 'uber eats',
    priority: 111,
  },
  {
    key: 'just_eat',
    en: 'Just Eat',
    categoryKey: 'restaurants',
    contains: 'just eat',
    priority: 112,
  },
  {
    key: 'deliveroo',
    en: 'Deliveroo',
    categoryKey: 'restaurants',
    contains: 'deliveroo',
    priority: 113,
  },
  {
    key: 'mcdonalds',
    en: "McDonald's",
    categoryKey: 'restaurants',
    contains: 'mcdonald',
    priority: 114,
  },
  {
    key: 'starbucks',
    en: 'Starbucks',
    categoryKey: 'restaurants',
    contains: 'starbucks',
    priority: 115,
  },
  {
    key: 'telepizza',
    en: 'Telepizza',
    categoryKey: 'restaurants',
    contains: 'telepizza',
    priority: 116,
  },
  // — Transport — `uber` after `uber eats` so delivery isn't miscounted —
  {
    key: 'uber',
    en: 'Uber',
    categoryKey: 'transport',
    contains: 'uber',
    priority: 120,
  },
  {
    key: 'cabify',
    en: 'Cabify',
    categoryKey: 'transport',
    contains: 'cabify',
    priority: 121,
  },
  {
    key: 'renfe',
    en: 'Renfe',
    categoryKey: 'transport',
    contains: 'renfe',
    priority: 122,
  },
  {
    key: 'repsol',
    en: 'Repsol',
    categoryKey: 'transport',
    contains: 'repsol',
    priority: 123,
  },
  {
    key: 'cepsa',
    en: 'Cepsa',
    categoryKey: 'transport',
    contains: 'cepsa',
    priority: 124,
  },
  // — Utilities & telecom —
  {
    key: 'endesa',
    en: 'Endesa',
    categoryKey: 'utilities',
    contains: 'endesa',
    priority: 130,
  },
  {
    key: 'iberdrola',
    en: 'Iberdrola',
    categoryKey: 'utilities',
    contains: 'iberdrola',
    priority: 131,
  },
  {
    key: 'naturgy',
    en: 'Naturgy',
    categoryKey: 'utilities',
    contains: 'naturgy',
    priority: 132,
  },
  {
    key: 'movistar',
    en: 'Movistar',
    categoryKey: 'utilities',
    contains: 'movistar',
    priority: 133,
  },
  {
    key: 'vodafone',
    en: 'Vodafone',
    categoryKey: 'utilities',
    contains: 'vodafone',
    priority: 134,
  },
  {
    key: 'orange',
    en: 'Orange',
    categoryKey: 'utilities',
    contains: 'orange',
    priority: 135,
  },
  // — Income (salary) —
  {
    key: 'nomina',
    en: 'Payroll (Nómina)',
    categoryKey: 'salary',
    contains: 'nomina',
    priority: 140,
  },
  {
    key: 'payroll',
    en: 'Payroll',
    categoryKey: 'salary',
    contains: 'payroll',
    priority: 141,
  },
] as const
