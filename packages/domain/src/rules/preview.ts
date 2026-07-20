import { type MatchableTxn, matchesRule } from './match'
import type { RuleConditions } from './types'

/**
 * "Test a rule against existing data" preview core (P3-06).
 *
 * Counts how many of a transaction sample a candidate rule's conditions would
 * match, returning a capped slice of the matched rows for display. Pure: no
 * I/O. The Server Action (fetch the user's transactions, RLS-enforced) + UI are
 * the P5-01 follow-up; this is the deterministic core they call. Operates on a
 * bare `RuleConditions` so it previews a rule that has not been persisted yet.
 */

const DEFAULT_LIMIT = 50

export interface RulePreview {
  /** How many rows the conditions match (across the whole sample). */
  matched: number
  /** Up to `limit` matched rows, for display. */
  rows: MatchableTxn[]
  /** Total rows considered. */
  total: number
}

/**
 * Match `conditions` (AND-combined, P3-02 semantics) against `txns`. `matched`
 * counts every match; `rows` is capped at `limit` (default 50) so a large data
 * set doesn't balloon the payload.
 */
export function previewRuleMatches(
  conditions: RuleConditions,
  txns: MatchableTxn[],
  opts: { limit?: number } = {}
): RulePreview {
  const limit = opts.limit ?? DEFAULT_LIMIT
  // Wrap the bare conditions in a minimal enabled rule so the matcher's
  // AND-semantics apply unchanged (category/priority are irrelevant here).
  const rule = {
    id: 'preview',
    categoryId: 'preview',
    conditions,
    priority: 0,
    enabled: true,
  }
  let matched = 0
  const rows: MatchableTxn[] = []
  for (const txn of txns) {
    if (matchesRule(rule, txn)) {
      matched += 1
      if (rows.length < limit) {
        rows.push(txn)
      }
    }
  }
  return { total: txns.length, matched, rows }
}
