/** Income (coupons, interest, distributions) received on a manual asset. */

export interface ManualAssetIncomeEvent {
  amountCents: number
  receivedDate: string
}

/** Sum of income events whose received date falls within [fromIso, toIso]. */
export function incomeInRangeCents(
  events: ManualAssetIncomeEvent[],
  fromIso: string,
  toIso: string
): number {
  let total = 0
  for (const e of events) {
    if (e.receivedDate >= fromIso && e.receivedDate <= toIso) {
      total += e.amountCents
    }
  }
  return total
}
