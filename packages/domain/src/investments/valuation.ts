/**
 * Position valuation (Inversiones A2). Pure. Null price (no cached quote yet)
 * propagates as null valuation — callers surface a freshness caveat instead
 * of pretending the position is worth zero.
 */
export function valueHolding(
  holding: { quantity: number; investedCents: number },
  currentPriceCents: number | null
): {
  currentValueCents: number | null
  unrealizedPlCents: number | null
  unrealizedPlPct: number | null
} {
  if (currentPriceCents === null) {
    return {
      currentValueCents: null,
      unrealizedPlCents: null,
      unrealizedPlPct: null,
    }
  }
  const currentValueCents = Math.round(holding.quantity * currentPriceCents)
  const unrealizedPlCents = currentValueCents - holding.investedCents
  return {
    currentValueCents,
    unrealizedPlCents,
    unrealizedPlPct:
      holding.investedCents > 0
        ? (unrealizedPlCents / holding.investedCents) * 100
        : null,
  }
}
