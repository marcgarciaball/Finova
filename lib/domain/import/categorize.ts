import type { RawTxn } from './adapter'

/**
 * Auto-categorization seam for imports (wired in P2-08, body in P3-03).
 *
 * P2-08 invokes this during commit with an empty rule set, so every row
 * resolves to `null` (uncategorized) — there is no rules engine yet. Wiring the
 * seam now keeps auto-categorization a first-class step of the import pipeline
 * rather than a later bolt-on, and gives P3-03 a single, tested integration
 * point. Pure: no I/O.
 */

/** A categorization rule. Fields are defined by P3-03 ("apply rules on import"). */
export interface CategorizationRule {
  /** Placeholder until P3-03 defines the matcher shape. */
  readonly _placeholder?: never
}

/**
 * Resolve a `category_id | null` for each transaction, index-aligned with
 * `txns`. With no rules every row is `null`; P3-03 implements the matching body.
 */
export function applyImportCategorization(
  txns: RawTxn[],
  rules: CategorizationRule[]
): (string | null)[] {
  // No rules engine yet (P3-03 fills the matching body). `rules` is accepted
  // now so the commit call site is stable; every row is uncategorized today.
  void rules
  return txns.map(() => null)
}
