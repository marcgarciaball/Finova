import {
  CurrencyMismatchError,
  InvalidAmountError,
  InvalidCurrencyError,
} from './errors'

/** A monetary value: integer minor units (cents) + ISO-4217 currency. */
export type Money = {
  readonly amount: number
  readonly currency: string
}

const CURRENCY_RE = /^[A-Z]{3}$/

/** Minor units per major unit. Fixed at 100 for all currencies (ADR-007). */
const MINOR_UNITS = 100

/** Round half away from zero (2.5 -> 3, -2.5 -> -3). */
function roundHalfUp(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value))
}

function assertCurrency(currency: string): void {
  if (!CURRENCY_RE.test(currency)) {
    throw new InvalidCurrencyError(currency)
  }
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new CurrencyMismatchError(a.currency, b.currency)
  }
}

/** Build Money from an integer number of minor units (cents). */
export function money(amount: number, currency: string): Money {
  if (!Number.isSafeInteger(amount)) {
    throw new InvalidAmountError(amount)
  }
  assertCurrency(currency)
  return { amount: amount === 0 ? 0 : amount, currency }
}

/** Build Money from a decimal in major units, e.g. 12.34 -> 1234 cents.
 *
 * Parses the string representation to avoid IEEE-754 float drift:
 * 1.005 * 100 = 100.4999... in float, but as a string "1.005" → 101 cents.
 */
export function fromDecimal(value: number, currency: string): Money {
  if (!Number.isFinite(value)) {
    throw new InvalidAmountError(value)
  }
  if (!/^-?\d+(\.\d+)?$/.test(String(value))) {
    throw new InvalidAmountError(value)
  }
  assertCurrency(currency)

  const sign = value < 0 ? -1 : 1
  const str = String(Math.abs(value))
  const dotIdx = str.indexOf('.')
  const shift = Math.log10(MINOR_UNITS) // 2 for cents

  let cents: number
  if (dotIdx === -1) {
    cents = Number.parseInt(str, 10) * MINOR_UNITS
  } else {
    const intPart = str.slice(0, dotIdx)
    const fracPart = str.slice(dotIdx + 1)
    // Pad or truncate fraction to `shift` digits, then check what's left for rounding.
    const paddedFrac = (fracPart + '0'.repeat(shift)).slice(0, shift)
    const remainder = (fracPart + '0'.repeat(shift)).slice(shift)
    const base = Number.parseInt(intPart + paddedFrac, 10)
    const firstRemainder =
      remainder.length > 0 ? Number.parseInt(remainder[0] as string, 10) : 0
    cents = base + (firstRemainder >= 5 ? 1 : 0)
  }

  return money(sign * cents, currency)
}

export function zero(currency: string): Money {
  return money(0, currency)
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return money(a.amount + b.amount, a.currency)
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return money(a.amount - b.amount, a.currency)
}

export function negate(m: Money): Money {
  return money(-m.amount, m.currency)
}

export function abs(m: Money): Money {
  return money(Math.abs(m.amount), m.currency)
}

export function multiply(m: Money, factor: number): Money {
  if (!Number.isFinite(factor)) {
    throw new InvalidAmountError(factor)
  }
  return money(roundHalfUp(m.amount * factor), m.currency)
}

export function convert(m: Money, targetCurrency: string, rate: number): Money {
  assertCurrency(targetCurrency)
  if (!Number.isFinite(rate)) {
    throw new InvalidAmountError(rate)
  }
  return money(roundHalfUp(m.amount * rate), targetCurrency)
}

export function equals(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.amount === b.amount
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b)
  if (a.amount < b.amount) return -1
  if (a.amount > b.amount) return 1
  return 0
}

export function greaterThan(a: Money, b: Money): boolean {
  return compare(a, b) === 1
}

export function lessThan(a: Money, b: Money): boolean {
  return compare(a, b) === -1
}

export function isZero(m: Money): boolean {
  return m.amount === 0
}

export function isPositive(m: Money): boolean {
  return m.amount > 0
}

export function isNegative(m: Money): boolean {
  return m.amount < 0
}

/**
 * Split `m` across `weights` using the largest-remainder method so the parts
 * always sum back to exactly `m.amount` (no cent lost or created).
 */
export function allocate(m: Money, weights: number[]): Money[] {
  if (weights.length === 0) {
    throw new InvalidAmountError('empty weights')
  }
  if (weights.some((w) => w < 0 || !Number.isFinite(w))) {
    throw new InvalidAmountError('negative or non-finite weight')
  }
  const total = weights.reduce((s, w) => s + w, 0)
  if (total === 0) {
    throw new InvalidAmountError('weights sum to zero')
  }

  const exact = weights.map((w) => (m.amount * w) / total)
  const floored = exact.map((x) => Math.floor(x))
  let remainder = m.amount - floored.reduce((s, x) => s + x, 0)

  // Hand out the leftover units to the largest fractional parts first.
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((p, q) => q.frac - p.frac)

  const amounts = [...floored]
  for (const { i } of order) {
    if (remainder === 0) break
    const step = remainder > 0 ? 1 : -1
    amounts[i] = (amounts[i] as number) + step
    remainder -= step
  }

  return amounts.map((a) => money(a, m.currency))
}
