/**
 * Dividend math (Inversiones Phase C). Pure. Amounts-per-share arrive in
 * major units (provider format) and leave as integer cents, rounded once per
 * event.
 */

export interface DividendTxn {
  quantity: number
  tradedAt: string
  type: 'buy' | 'sell'
}

export interface DividendEvent {
  amountPerShare: number // major units, native asset currency
  exDate: string
  payDate: string | null
}

const QTY_SCALE = 1e8

/** Units held at end of `date` (owning on the ex-date earns the dividend). */
export function quantityHeldOn(txns: DividendTxn[], date: string): number {
  let units = 0
  for (const t of txns) {
    if (t.tradedAt <= date) {
      units += Math.round(t.quantity * QTY_SCALE) * (t.type === 'buy' ? 1 : -1)
    }
  }
  return units / QTY_SCALE
}

/** Total received across events, given the position history. Integer cents. */
export function dividendsReceivedCents(
  txns: DividendTxn[],
  events: DividendEvent[]
): number {
  let total = 0
  for (const e of events) {
    const held = quantityHeldOn(txns, e.exDate)
    if (held > 0) {
      total += Math.round(held * e.amountPerShare * 100)
    }
  }
  return total
}

/** Sum of per-share amounts over the trailing 12 months, in cents/share. */
export function trailing12mPerShareCents(
  events: DividendEvent[],
  todayIso: string
): number {
  const cutoff = new Date(`${todayIso}T00:00:00Z`)
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1)
  const from = cutoff.toISOString().slice(0, 10)
  let perShare = 0
  for (const e of events) {
    if (e.exDate > from && e.exDate <= todayIso) {
      perShare += e.amountPerShare
    }
  }
  return Math.round(perShare * 100)
}

/**
 * Every received dividend as a dated cash event (date = pay date when known,
 * ex-date otherwise), so callers can period-filter. Integer cents per event.
 */
export function dividendsReceivedEvents(
  txns: DividendTxn[],
  events: DividendEvent[]
): { cents: number; date: string }[] {
  const out: { cents: number; date: string }[] = []
  for (const e of events) {
    const held = quantityHeldOn(txns, e.exDate)
    if (held > 0) {
      out.push({
        cents: Math.round(held * e.amountPerShare * 100),
        date: e.payDate ?? e.exDate,
      })
    }
  }
  return out
}

/** Received cents grouped by ex-date year, for the income bar chart. */
export function dividendsByYearCents(
  txns: DividendTxn[],
  events: DividendEvent[]
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of events) {
    const held = quantityHeldOn(txns, e.exDate)
    if (held > 0) {
      const year = e.exDate.slice(0, 4)
      out[year] = (out[year] ?? 0) + Math.round(held * e.amountPerShare * 100)
    }
  }
  return out
}
