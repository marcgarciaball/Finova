/**
 * Manual balance reconciliation (roadmap 1.1).
 *
 * When an account's real-world balance drifts from the derived
 * `opening + Σ transactions`, the user enters the true balance and we record a
 * single balancing **adjustment transaction** for the difference — history is
 * preserved, never edited. Pure and money-safe (integer cents in, integer cents
 * out); the action turns a non-zero delta into a transaction row.
 */

/** Signed cents to add so the account reaches `targetCents` from `currentCents`. */
export function reconciliationDelta(
  currentCents: number,
  targetCents: number
): number {
  return targetCents - currentCents
}
