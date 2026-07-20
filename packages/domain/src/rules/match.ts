import type { AmountOp, Clause, Rule } from './types'

/**
 * Categorization-rule matching engine (P3-02).
 *
 * Pure, deterministic, total: given a transaction and a user's rules, decide
 * which category (if any) wins. No I/O, no DB, no `Date.now()`. The stateful
 * edges — fetching the rules and applying the result on import / on demand —
 * are P3-03. Built against the contract P3-01 locked in
 * `lib/domain/rules/types.ts`.
 *
 * Semantics (per the design):
 * - A rule's clauses are AND-combined (`matchesRule`).
 * - String clauses are case-insensitive; accent-sensitive (v1 — see below).
 * - `regex` compiles case-insensitively and never throws (invalid → no match).
 * - Amount comparison is signed by default; `absolute` compares the magnitude.
 * - `selectCategory` is first-match-wins over enabled rules ordered by
 *   `priority` ascending; ties keep input order (= created_at order, per the
 *   P3-03 fetch).
 */

/** The minimum a transaction must expose to be matched against rules. */
export interface MatchableTxn {
  accountId: string
  /** Signed integer cents (negative = expense, positive = income). */
  amountCents: number
  description: string
}

function compareAmount(
  op: AmountOp,
  actual: number,
  expected: number
): boolean {
  switch (op) {
    case 'lt':
      return actual < expected
    case 'lte':
      return actual <= expected
    case 'gt':
      return actual > expected
    case 'gte':
      return actual >= expected
    case 'eq':
      return actual === expected
  }
}

/** Does one clause hold for this transaction? Total — never throws. */
export function matchesClause(clause: Clause, txn: MatchableTxn): boolean {
  switch (clause.field) {
    case 'description': {
      // Accent-sensitive in v1 (folding would diverge from what the user typed
      // in the rule); case-insensitive since bank descriptions vary in case.
      const haystack = txn.description.toLowerCase()
      const needle = clause.value.toLowerCase()
      switch (clause.op) {
        case 'contains':
          return haystack.includes(needle)
        case 'equals':
          return haystack === needle
        case 'starts_with':
          return haystack.startsWith(needle)
        case 'regex':
          // Total: a malformed pattern matches nothing rather than crashing a
          // batch. The P3-01 200-char cap bounds the ReDoS surface.
          try {
            return new RegExp(clause.value, 'i').test(txn.description)
          } catch {
            return false
          }
      }
      return false
    }
    case 'amount_cents': {
      const actual = clause.absolute
        ? Math.abs(txn.amountCents)
        : txn.amountCents
      return compareAmount(clause.op, actual, clause.value)
    }
    case 'account_id':
      return txn.accountId === clause.value
  }
}

/** Do ALL of a rule's clauses hold (AND-combined)? Ignores `enabled`. */
export function matchesRule(rule: Rule, txn: MatchableTxn): boolean {
  return rule.conditions.every((clause) => matchesClause(clause, txn))
}

/**
 * Enabled rules in precedence order: `priority` ascending, ties keeping input
 * order (= created_at order, per the P3-03 fetch — `Array.prototype.sort` is
 * stable). Hoist this once when matching many transactions against one rule set
 * (see `applyImportCategorization`) so the sort isn't repeated per row.
 */
export function orderRules(rules: Rule[]): Rule[] {
  return rules
    .filter((rule) => rule.enabled)
    .sort((a, b) => a.priority - b.priority)
}

/**
 * The category a transaction should get, or `null` if no enabled rule matches.
 * First enabled rule (precedence order) whose AND-clauses all match wins. Pure
 * and deterministic.
 */
export function selectCategory(
  rules: Rule[],
  txn: MatchableTxn
): string | null {
  const winner = orderRules(rules).find((rule) => matchesRule(rule, txn))
  return winner?.categoryId ?? null
}
