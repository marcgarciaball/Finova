import { normalizeDescription } from '../import/fingerprint'
import type { RuleConditions } from './types'

/**
 * "Make this a rule" suggestion core (P3-05).
 *
 * Derives a sensible `description contains <token>` rule from a corrected
 * transaction so future imports of the same merchant auto-categorize. Pure: no
 * I/O. The UI affordance + create-rule action are the P5-01 follow-up; this is
 * the deterministic core they call.
 */

/**
 * Common bank-statement prefixes/noise that aren't the merchant. Dropped when
 * picking the token so `COMPRA MERCADONA` suggests `mercadona`, not `compra`.
 */
const STOPWORDS = new Set([
  'compra',
  'compras',
  'pago',
  'pagos',
  'recibo',
  'recb',
  'tarjeta',
  'transferencia',
  'transf',
  'traspaso',
  'tarj',
  'bizum',
  'adeudo',
  'domiciliacion',
  'dom',
  'devolucion',
  'abono',
  'payment',
  'card',
  'purchase',
  'debit',
  'credit',
  'transfer',
  'the',
  'and',
  'los',
  'las',
  'con',
  'por',
  'para',
  'del',
])

const MIN_TOKEN_LEN = 3

/** Masked card/account numbers, e.g. `5402xxxxxxxx7019` — digits and `x` only. */
const MASKED_NUMBER = /^[0-9x]+$/

/**
 * The merchant-ish token to match on: the first normalized word that isn't a
 * banking stopword, a pure number, a masked card/account number, or too
 * short. Falls back to the whole normalized string so the token is never
 * empty for a non-empty description (an empty `contains` would match
 * everything).
 */
export function suggestRuleToken(description: string): string {
  const normalized = normalizeDescription(description)
  const tokens = normalized.split(' ').filter(Boolean)
  const meaningful = tokens.find(
    (t) =>
      t.length >= MIN_TOKEN_LEN &&
      !/^\d+$/.test(t) &&
      !MASKED_NUMBER.test(t) &&
      !STOPWORDS.has(t)
  )
  return meaningful ?? normalized
}

/** Capitalize the first letter of each space-separated word. */
function titleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Build a `createCategorizationRuleSchema`-valid suggestion from a correction.
 * `priority` 0 so a user's explicit correction outranks the seeded defaults
 * (priority ≥ 100). `name` defaults to the title-cased token.
 */
export function suggestRuleFromCorrection(input: {
  description: string
  categoryId: string
  name?: string
}): {
  name: string
  categoryId: string
  conditions: RuleConditions
  priority: number
} {
  const token = suggestRuleToken(input.description)
  return {
    name: input.name ?? titleCase(token),
    categoryId: input.categoryId,
    conditions: [{ field: 'description', op: 'contains', value: token }],
    priority: 0,
  }
}
