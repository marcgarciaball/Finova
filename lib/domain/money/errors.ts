/** Thrown when an amount is not a safe integer number of minor units. */
export class InvalidAmountError extends Error {
  constructor(amount: unknown) {
    super(`Invalid money amount: ${String(amount)} (expected a safe integer)`)
    this.name = 'InvalidAmountError'
  }
}

/** Thrown when a currency code is not a 3-letter uppercase ISO-4217 code. */
export class InvalidCurrencyError extends Error {
  constructor(currency: unknown) {
    super(`Invalid currency code: ${String(currency)} (expected /^[A-Z]{3}$/)`)
    this.name = 'InvalidCurrencyError'
  }
}

/** Thrown when an operation mixes two different currencies. */
export class CurrencyMismatchError extends Error {
  readonly a: string
  readonly b: string
  constructor(a: string, b: string) {
    super(`Currency mismatch: ${a} vs ${b}`)
    this.name = 'CurrencyMismatchError'
    this.a = a
    this.b = b
  }
}
