/**
 * Projected interest for accounts with a nominal annual rate (`interest_rate_bps`
 * on `accounts`). Purely a projection from the current balance — never posted
 * as a real transaction, never folded into actual income totals (ADR-007's
 * sign-based income stays transaction-only).
 */

/** Annual interest in cents for a balance at a nominal rate (basis points). */
export function projectedAnnualInterestCents(
  balanceCents: number,
  rateBps: number
): number {
  return Math.round((balanceCents * rateBps) / 10_000)
}
