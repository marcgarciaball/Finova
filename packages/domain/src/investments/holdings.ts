/**
 * Average-cost holdings engine (Inversiones A2). Pure: rebuilds one asset's
 * position from its transaction log. Quantities are handled as integer 1e-8
 * units so 8-dp crypto math is exact; the cost basis is accumulated as an
 * exact float and rounded to integer cents only at the output boundary.
 */

export interface HoldingTxn {
  currency: string
  feesCents: number
  priceCents: number // per unit, integer cents, native currency
  quantity: number // > 0, ≤ 8 decimal places
  tradedAt: string // ISO date
  type: 'buy' | 'sell'
}

export interface HoldingComputation {
  avgCostCents: number // per unit, 0 when flat
  investedCents: number // remaining cost basis
  quantity: number
  realizedPlCents: number // accumulated from sells, net of sell fees
}

export class OversellError extends Error {
  constructor(
    readonly txnIndex: number,
    readonly tradedAt: string
  ) {
    super(`sell exceeds held quantity (txn ${txnIndex} @ ${tradedAt})`)
    this.name = 'OversellError'
  }
}

export class MixedCurrencyError extends Error {
  constructor() {
    super('holding transactions must share one currency')
    this.name = 'MixedCurrencyError'
  }
}

const QTY_SCALE = 1e8

const toUnits = (quantity: number): number => Math.round(quantity * QTY_SCALE)

export function computeHolding(txns: HoldingTxn[]): HoldingComputation {
  const currency = txns[0]?.currency
  if (currency !== undefined && txns.some((t) => t.currency !== currency)) {
    throw new MixedCurrencyError()
  }

  // Stable sort by trade date; ties keep input order. Keep the original index
  // for error reporting.
  const ordered = txns
    .map((txn, index) => ({ txn, index }))
    .sort((a, b) => a.txn.tradedAt.localeCompare(b.txn.tradedAt))

  let heldUnits = 0
  let basisCents = 0
  let realizedCents = 0

  for (const { txn, index } of ordered) {
    const units = toUnits(txn.quantity)
    if (txn.type === 'buy') {
      basisCents += (units / QTY_SCALE) * txn.priceCents + txn.feesCents
      heldUnits += units
      continue
    }
    if (units > heldUnits) {
      throw new OversellError(index, txn.tradedAt)
    }
    const avg = basisCents / (heldUnits / QTY_SCALE) // cents per unit, unrounded
    const qty = units / QTY_SCALE
    realizedCents += qty * (txn.priceCents - avg) - txn.feesCents
    basisCents -= qty * avg
    heldUnits -= units
  }

  const quantity = heldUnits / QTY_SCALE
  return {
    quantity,
    avgCostCents: heldUnits > 0 ? Math.round(basisCents / quantity) : 0,
    investedCents: heldUnits > 0 ? Math.round(basisCents) : 0,
    realizedPlCents: Math.round(realizedCents),
  }
}
