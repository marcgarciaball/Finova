/**
 * Pick the single currency the dashboard renders (P4-04). The cores are all
 * per-currency (never summed across — the P1-07 no-FX invariant), so the page
 * must choose one to drive the headline tiles + charts. Pure.
 *
 * Preference: the profile `base_currency` if the user has any activity in it;
 * otherwise the most-used currency (modal), tie-broken by currency code so the
 * choice is deterministic; otherwise (no transactions) the base currency.
 */
export function pickDisplayCurrency(
  txns: { currency: string }[],
  base: string
): string {
  if (txns.length === 0) return base

  const counts = new Map<string, number>()
  for (const t of txns) {
    counts.set(t.currency, (counts.get(t.currency) ?? 0) + 1)
    if (t.currency === base) return base
  }

  let best = base
  let bestCount = -1
  for (const [currency, count] of counts) {
    if (count > bestCount || (count === bestCount && currency < best)) {
      best = currency
      bestCount = count
    }
  }
  return best
}
