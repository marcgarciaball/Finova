import { matchesRule, orderRules } from '../rules/match'
import type { Rule } from '../rules/types'
import type { RawTxn } from './adapter'

/**
 * Auto-categorization seam for imports (wired in P2-08, body in P3-03).
 *
 * Resolves each row's category through the P3-02 matcher: the first enabled
 * rule (priority ascending, created_at-ordered ties) whose AND-clauses all
 * match wins; no match ⇒ `null` (committed uncategorized). Pure: no I/O — the
 * caller fetches the rules (RLS-enforced) and supplies the batch account.
 */

/**
 * Resolve a `category_id | null` for each transaction, index-aligned with
 * `txns`. Every row in a batch shares `accountId` (chosen at review time);
 * `RawTxn` has no account, so it is threaded in here for `account_id` clauses.
 */
export function applyImportCategorization(
  txns: RawTxn[],
  rules: Rule[],
  accountId: string
): (string | null)[] {
  // Order the rules once for the whole batch (not per row).
  const ordered = orderRules(rules)
  return txns.map((txn) => {
    const m = {
      description: txn.description,
      amountCents: txn.amountCents,
      accountId,
    }
    return ordered.find((rule) => matchesRule(rule, m))?.categoryId ?? null
  })
}
