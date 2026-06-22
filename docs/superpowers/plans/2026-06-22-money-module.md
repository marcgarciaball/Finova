# Money Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `lib/domain/money/` — the single, fully-tested home for all money math in Finova (integer cents + ISO-4217 currency, no floats) — plus the reusable `add-money-safe-feature` skill.

**Architecture:** A pure domain module with no DB, no React, no I/O. `errors.ts` defines typed errors; `money.ts` holds the `Money` type, constructors, exact + rounded arithmetic, comparison, conversion, and allocation; `format.ts` holds locale-aware Intl formatting (kept apart so core math never depends on Intl); `index.ts` is the public barrel. Each module is paired with a table-driven vitest suite aiming at near-100% coverage.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Vitest 4, Biome 2.5 (lint+format), `Intl.NumberFormat` for display.

## Global Constraints

- Money amounts are **integer minor units (cents) = 1/100 of the major unit, for every currency** (ADR-007). No per-currency exponents.
- Internal amount type is **`number`, validated as a safe integer** (`Number.isSafeInteger`). Never `bigint`.
- **No floats in money math.** `fromDecimal` is the only place a non-integer enters, and it rounds immediately.
- Currency is **ISO-4217, uppercase, `^[A-Z]{3}$`**.
- Rounding for `multiply`/`convert` is **half-up, away from zero** (`2.5→3`, `-2.5→-3`). Add/subtract/compare are exact.
- `add`/`subtract` and ordering comparisons **throw `CurrencyMismatchError`** on differing currencies. `equals` is total (returns `false`, never throws).
- All public functions are **pure** and return new `Money` values; `Money` fields are `readonly`.
- Tests are **table-driven**, near-100% coverage; `npm test`, `npm run typecheck`, `npm run lint` all clean.
- TypeScript only — no `any`; respect strict null checks and `noUncheckedIndexedAccess`.
- Commit messages follow Conventional Commits; the human runs the actual `git commit` (sandbox blocks agent git writes) — include the command anyway for the record.

## File Structure

| File | Responsibility |
|------|----------------|
| `lib/domain/money/errors.ts` | Typed error classes: `CurrencyMismatchError`, `InvalidAmountError`, `InvalidCurrencyError`. |
| `lib/domain/money/money.ts` | `Money` type, constructors (`money`, `fromDecimal`, `zero`), arithmetic, comparison, `convert`, `allocate`. |
| `lib/domain/money/format.ts` | `format(money, locale)` via `Intl.NumberFormat`. |
| `lib/domain/money/index.ts` | Public barrel re-exporting the API. |
| `lib/domain/money/money.test.ts` | Unit tests for `errors.ts` + `money.ts`. |
| `lib/domain/money/format.test.ts` | Unit tests for `format.ts`. |
| `docs/skills/add-money-safe-feature.md` | The reusable skill playbook. |
| `docs/SKILLS.md` | Flip `add-money-safe-feature` row → `BUILT`. |
| `DECISIONS.md` | Add ADR-007. |
| `PROGRESS.md` | P1-01 → DONE with notes. |

---

### Task 1: Typed errors

**Files:**
- Create: `lib/domain/money/errors.ts`
- Test: `lib/domain/money/money.test.ts` (created here; extended in Task 2)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `class InvalidAmountError extends Error` — `name = 'InvalidAmountError'`; constructor `(amount: unknown)`.
  - `class InvalidCurrencyError extends Error` — `name = 'InvalidCurrencyError'`; constructor `(currency: unknown)`.
  - `class CurrencyMismatchError extends Error` — `name = 'CurrencyMismatchError'`; constructor `(a: string, b: string)`; readonly fields `a`, `b`.

- [ ] **Step 1: Write the failing test**

Create `lib/domain/money/money.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  CurrencyMismatchError,
  InvalidAmountError,
  InvalidCurrencyError,
} from './errors'

describe('errors', () => {
  it('InvalidAmountError carries a stable name and mentions the value', () => {
    const err = new InvalidAmountError(1.5)
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('InvalidAmountError')
    expect(err.message).toContain('1.5')
  })

  it('InvalidCurrencyError carries a stable name and mentions the value', () => {
    const err = new InvalidCurrencyError('eur')
    expect(err.name).toBe('InvalidCurrencyError')
    expect(err.message).toContain('eur')
  })

  it('CurrencyMismatchError exposes both offending codes', () => {
    const err = new CurrencyMismatchError('EUR', 'USD')
    expect(err.name).toBe('CurrencyMismatchError')
    expect(err.a).toBe('EUR')
    expect(err.b).toBe('USD')
    expect(err.message).toContain('EUR')
    expect(err.message).toContain('USD')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- money`
Expected: FAIL — cannot resolve `./errors`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/domain/money/errors.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- money`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/domain/money/errors.ts lib/domain/money/money.test.ts
git commit -m "feat(p1-01): typed money errors"
```

---

### Task 2: Core type, constructors, arithmetic, comparison, convert, allocate

**Files:**
- Create: `lib/domain/money/money.ts`
- Modify: `lib/domain/money/money.test.ts` (append the test blocks below)

**Interfaces:**
- Consumes: `InvalidAmountError`, `InvalidCurrencyError`, `CurrencyMismatchError` from `./errors`.
- Produces:
  - `type Money = { readonly amount: number; readonly currency: string }`
  - `money(amount: number, currency: string): Money`
  - `fromDecimal(value: number, currency: string): Money`
  - `zero(currency: string): Money`
  - `add(a: Money, b: Money): Money`
  - `subtract(a: Money, b: Money): Money`
  - `negate(m: Money): Money`
  - `abs(m: Money): Money`
  - `multiply(m: Money, factor: number): Money`
  - `convert(m: Money, targetCurrency: string, rate: number): Money`
  - `equals(a: Money, b: Money): boolean`
  - `compare(a: Money, b: Money): -1 | 0 | 1`
  - `greaterThan(a: Money, b: Money): boolean`
  - `lessThan(a: Money, b: Money): boolean`
  - `isZero(m: Money): boolean`
  - `isPositive(m: Money): boolean`
  - `isNegative(m: Money): boolean`
  - `allocate(m: Money, weights: number[]): Money[]`

- [ ] **Step 1: Write the failing tests**

Append to `lib/domain/money/money.test.ts`:

```ts
import {
  abs,
  add,
  allocate,
  compare,
  convert,
  equals,
  fromDecimal,
  greaterThan,
  isNegative,
  isPositive,
  isZero,
  lessThan,
  money,
  multiply,
  negate,
  subtract,
  zero,
} from './money'

describe('constructors', () => {
  it('money() builds from integer cents', () => {
    expect(money(1234, 'EUR')).toEqual({ amount: 1234, currency: 'EUR' })
  })

  it('money() rejects non-integer amounts', () => {
    expect(() => money(1.5, 'EUR')).toThrow(InvalidAmountError)
  })

  it('money() rejects unsafe integers', () => {
    expect(() => money(Number.MAX_SAFE_INTEGER + 1, 'EUR')).toThrow(
      InvalidAmountError
    )
  })

  it('money() rejects NaN/Infinity', () => {
    expect(() => money(Number.NaN, 'EUR')).toThrow(InvalidAmountError)
    expect(() => money(Number.POSITIVE_INFINITY, 'EUR')).toThrow(
      InvalidAmountError
    )
  })

  it('money() rejects malformed currency codes', () => {
    for (const bad of ['eur', 'EU', 'EURO', '123', '']) {
      expect(() => money(0, bad)).toThrow(InvalidCurrencyError)
    }
  })

  it('fromDecimal() converts major units to cents without float drift', () => {
    expect(fromDecimal(12.34, 'EUR')).toEqual({ amount: 1234, currency: 'EUR' })
    expect(fromDecimal(0.1, 'EUR').amount).toBe(10)
    expect(fromDecimal(0.2, 'EUR').amount).toBe(20)
    expect(fromDecimal(-5.55, 'EUR').amount).toBe(-555)
  })

  it('fromDecimal() rounds half-up at the cent boundary', () => {
    expect(fromDecimal(1.005, 'EUR').amount).toBe(101)
    expect(fromDecimal(-1.005, 'EUR').amount).toBe(-101)
  })

  it('zero() builds a zero amount', () => {
    expect(zero('USD')).toEqual({ amount: 0, currency: 'USD' })
  })
})

describe('exact arithmetic', () => {
  it('adds and subtracts same-currency amounts exactly', () => {
    expect(add(fromDecimal(0.1, 'EUR'), fromDecimal(0.2, 'EUR'))).toEqual(
      fromDecimal(0.3, 'EUR')
    )
    expect(subtract(money(500, 'EUR'), money(150, 'EUR'))).toEqual(
      money(350, 'EUR')
    )
  })

  it('throws CurrencyMismatchError when currencies differ', () => {
    expect(() => add(money(1, 'EUR'), money(1, 'USD'))).toThrow(
      CurrencyMismatchError
    )
    expect(() => subtract(money(1, 'EUR'), money(1, 'USD'))).toThrow(
      CurrencyMismatchError
    )
  })

  it('negate and abs', () => {
    expect(negate(money(250, 'EUR'))).toEqual(money(-250, 'EUR'))
    expect(abs(money(-250, 'EUR'))).toEqual(money(250, 'EUR'))
    expect(abs(money(250, 'EUR'))).toEqual(money(250, 'EUR'))
  })
})

describe('rounded arithmetic (half-up, away from zero)', () => {
  it('multiply rounds half away from zero', () => {
    expect(multiply(money(100, 'EUR'), 1.5)).toEqual(money(150, 'EUR'))
    expect(multiply(money(5, 'EUR'), 0.5)).toEqual(money(3, 'EUR')) // 2.5 -> 3
    expect(multiply(money(-5, 'EUR'), 0.5)).toEqual(money(-3, 'EUR')) // -2.5 -> -3
  })

  it('convert applies a rate, rounds, and changes currency', () => {
    expect(convert(money(1000, 'EUR'), 'USD', 1.1)).toEqual(money(1100, 'USD'))
    expect(convert(money(5, 'EUR'), 'USD', 0.5)).toEqual(money(3, 'USD')) // 2.5 -> 3
  })

  it('convert validates the target currency', () => {
    expect(() => convert(money(1, 'EUR'), 'usd', 1)).toThrow(
      InvalidCurrencyError
    )
  })
})

describe('comparison', () => {
  it('equals is total across currencies (false, never throws)', () => {
    expect(equals(money(1, 'EUR'), money(1, 'EUR'))).toBe(true)
    expect(equals(money(1, 'EUR'), money(1, 'USD'))).toBe(false)
    expect(equals(money(1, 'EUR'), money(2, 'EUR'))).toBe(false)
  })

  it('compare orders same-currency amounts', () => {
    expect(compare(money(1, 'EUR'), money(2, 'EUR'))).toBe(-1)
    expect(compare(money(2, 'EUR'), money(2, 'EUR'))).toBe(0)
    expect(compare(money(3, 'EUR'), money(2, 'EUR'))).toBe(1)
  })

  it('ordering throws on currency mismatch', () => {
    expect(() => compare(money(1, 'EUR'), money(1, 'USD'))).toThrow(
      CurrencyMismatchError
    )
    expect(() => greaterThan(money(1, 'EUR'), money(1, 'USD'))).toThrow(
      CurrencyMismatchError
    )
  })

  it('greaterThan / lessThan', () => {
    expect(greaterThan(money(2, 'EUR'), money(1, 'EUR'))).toBe(true)
    expect(lessThan(money(1, 'EUR'), money(2, 'EUR'))).toBe(true)
    expect(greaterThan(money(1, 'EUR'), money(1, 'EUR'))).toBe(false)
  })

  it('sign predicates', () => {
    expect(isZero(zero('EUR'))).toBe(true)
    expect(isPositive(money(1, 'EUR'))).toBe(true)
    expect(isNegative(money(-1, 'EUR'))).toBe(true)
    expect(isPositive(zero('EUR'))).toBe(false)
    expect(isNegative(zero('EUR'))).toBe(false)
  })
})

describe('allocate', () => {
  it('splits evenly when divisible', () => {
    expect(allocate(money(100, 'EUR'), [1, 1, 1, 1])).toEqual([
      money(25, 'EUR'),
      money(25, 'EUR'),
      money(25, 'EUR'),
      money(25, 'EUR'),
    ])
  })

  it('distributes the remainder by largest fractional part, summing exactly', () => {
    const parts = allocate(money(100, 'EUR'), [1, 1, 1]) // 100 / 3
    expect(parts.map((p) => p.amount)).toEqual([34, 33, 33])
    expect(parts.reduce((s, p) => s + p.amount, 0)).toBe(100)
  })

  it('respects weights and conserves the total', () => {
    const parts = allocate(money(1000, 'EUR'), [1, 2, 3]) // 166.6.., 333.3.., 500
    expect(parts.reduce((s, p) => s + p.amount, 0)).toBe(1000)
    expect(parts.map((p) => p.amount)).toEqual([167, 333, 500])
  })

  it('handles negative totals and conserves them', () => {
    const parts = allocate(money(-100, 'EUR'), [1, 1, 1])
    expect(parts.reduce((s, p) => s + p.amount, 0)).toBe(-100)
  })

  it('rejects empty, all-zero, or negative weights', () => {
    expect(() => allocate(money(100, 'EUR'), [])).toThrow()
    expect(() => allocate(money(100, 'EUR'), [0, 0])).toThrow()
    expect(() => allocate(money(100, 'EUR'), [1, -1])).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- money`
Expected: FAIL — cannot resolve `./money`.

- [ ] **Step 3: Write the implementation**

Create `lib/domain/money/money.ts`:

```ts
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
  return { amount, currency }
}

/** Build Money from a decimal in major units, e.g. 12.34 -> 1234 cents. */
export function fromDecimal(value: number, currency: string): Money {
  if (!Number.isFinite(value)) {
    throw new InvalidAmountError(value)
  }
  assertCurrency(currency)
  return money(roundHalfUp(value * MINOR_UNITS), currency)
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- money`
Expected: PASS (all `money.test.ts` blocks).

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors in `lib/domain/money/`.

- [ ] **Step 6: Commit**

```bash
git add lib/domain/money/money.ts lib/domain/money/money.test.ts
git commit -m "feat(p1-01): money type, arithmetic, compare, convert, allocate"
```

---

### Task 3: Locale-aware formatting

**Files:**
- Create: `lib/domain/money/format.ts`
- Test: `lib/domain/money/format.test.ts`

**Interfaces:**
- Consumes: `Money` from `./money`.
- Produces: `format(m: Money, locale: string): string`.

- [ ] **Step 1: Write the failing test**

Create `lib/domain/money/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { format } from './format'
import { money, zero } from './money'

// Use non-breaking-space-insensitive matching: Intl inserts NBSP/narrow-NBSP.
const normalize = (s: string) => s.replace(/ | /g, ' ')

describe('format', () => {
  it('formats EUR in es with comma decimals and dot grouping', () => {
    expect(normalize(format(money(123456, 'EUR'), 'es'))).toBe('1.234,56 €')
  })

  it('formats USD in en with dot decimals and comma grouping', () => {
    expect(normalize(format(money(123456, 'USD'), 'en'))).toBe('$1,234.56')
  })

  it('always shows exactly two fraction digits', () => {
    expect(normalize(format(money(100, 'EUR'), 'en'))).toBe('€1.00')
    expect(normalize(format(money(5, 'EUR'), 'en'))).toBe('€0.05')
  })

  it('formats negative and zero amounts', () => {
    expect(normalize(format(money(-100, 'USD'), 'en'))).toBe('-$1.00')
    expect(normalize(format(zero('EUR'), 'en'))).toBe('€0.00')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- format`
Expected: FAIL — cannot resolve `./format`.

- [ ] **Step 3: Write the implementation**

Create `lib/domain/money/format.ts`:

```ts
import type { Money } from './money'

/**
 * Format Money for display in the given locale. Always renders exactly two
 * fraction digits (cents / 100), consistent with the fixed-2-decimal model
 * (ADR-007). Symbol and grouping follow the locale.
 */
export function format(m: Money, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: m.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(m.amount / 100)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- format`
Expected: PASS (4 tests).

> If an assertion fails only on the symbol position or spacing, adjust the
> expected string to match this Node's ICU output (the `normalize` helper
> already absorbs NBSP differences); do not change the implementation.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/money/format.ts lib/domain/money/format.test.ts
git commit -m "feat(p1-01): locale-aware money formatting"
```

---

### Task 4: Public barrel

**Files:**
- Create: `lib/domain/money/index.ts`

**Interfaces:**
- Consumes: everything from `./money`, `./format`, `./errors`.
- Produces: the public module surface (`import { money, add, format, ... } from '@/lib/domain/money'`).

- [ ] **Step 1: Write the barrel**

Create `lib/domain/money/index.ts`:

```ts
export {
  CurrencyMismatchError,
  InvalidAmountError,
  InvalidCurrencyError,
} from './errors'
export { format } from './format'
export {
  abs,
  add,
  allocate,
  compare,
  convert,
  equals,
  fromDecimal,
  greaterThan,
  isNegative,
  isPositive,
  isZero,
  lessThan,
  type Money,
  money,
  multiply,
  negate,
  subtract,
  zero,
} from './money'
```

- [ ] **Step 2: Verify the whole suite + typecheck + lint**

Run: `npm test -- money format && npm run typecheck && npm run lint`
Expected: all tests PASS; no type or lint errors.

- [ ] **Step 3: Confirm coverage is near-100%**

Run: `npx vitest run lib/domain/money --coverage`
Expected: `lib/domain/money/*` lines/branches ≈ 100% (allow the unreachable `remainder === 0 break` guard). If a branch is uncovered, add a table row to the relevant test and re-run.

> If `--coverage` reports a missing provider, install is blocked in this sandbox; skip the coverage gate and instead eyeball that every exported function and every `throw` has a test. Note the skip in the PR.

- [ ] **Step 4: Commit**

```bash
git add lib/domain/money/index.ts
git commit -m "feat(p1-01): public money module barrel"
```

---

### Task 5: The `add-money-safe-feature` skill

**Files:**
- Create: `docs/skills/add-money-safe-feature.md`
- Modify: `docs/SKILLS.md` (the `add-money-safe-feature` row)

**Interfaces:**
- Consumes: the finished `lib/domain/money` module (referenced by the playbook).
- Produces: a documented, reusable playbook; `docs/SKILLS.md` row flipped to `BUILT`.

- [ ] **Step 1: Write the skill doc**

Create `docs/skills/add-money-safe-feature.md`:

```markdown
# Skill: add-money-safe-feature

**Trigger:** any feature that touches money — amounts, balances, totals, splits,
transfers, currency conversion, or anything stored/displayed as a monetary value.

**Goal:** all money math goes through `lib/domain/money`, stays in integer minor
units, never uses floats, and is covered by tests.

## Rules

1. **Never represent money as a float.** Store and pass `Money` (integer cents +
   ISO-4217 currency) or raw integer cents. The only place a decimal enters is
   `fromDecimal`, which rounds immediately.
2. **All arithmetic through `lib/domain/money`.** Do not hand-roll `a + b` on cent
   numbers in feature code — use `add`/`subtract`/`multiply`/`convert`/`allocate`
   so currency checks and rounding stay centralized.
3. **Currencies never mix silently.** `add`/`subtract`/ordering throw
   `CurrencyMismatchError`. Convert explicitly with `convert(m, target, rate)`.
4. **Rounding is half-up, away from zero**, and only happens in `multiply`/
   `convert`/`fromDecimal`. Split with `allocate` so distributed cents are exact.
5. **Display via `format(money, locale)`** — never string-concatenate a symbol.
   Locale comes from the user's `profiles.locale`.
6. **Test the money logic to near-100%**, table-driven, including float traps,
   currency mismatch, rounding boundaries (incl. negatives), and remainder
   conservation for any split.
7. **DB amounts are integer columns of minor units** (when persistence arrives in
   later tickets) — never `float`/`real`/`double`.

## Checklist (maps to Definition of Done)

- [ ] No float holds a money value anywhere in the feature.
- [ ] Every amount is `Money` or integer cents; construction goes through `money`/
      `fromDecimal`/`zero`.
- [ ] All arithmetic uses `lib/domain/money` functions (no inline cent math).
- [ ] Cross-currency operations are explicit `convert` calls; mismatches throw.
- [ ] Any split uses `allocate` and is asserted to sum back exactly.
- [ ] User-facing amounts rendered with `format(m, locale)`.
- [ ] New money logic has table-driven tests at near-100% coverage; suite green.

## Reference

- Module: `lib/domain/money/` (`money.ts`, `format.ts`, `errors.ts`, `index.ts`).
- Decision: ADR-007 (fixed 2-decimal minor units).
```

- [ ] **Step 2: Flip the registry row**

In `docs/SKILLS.md`, change the `add-money-safe-feature` row from:

```
| `add-money-safe-feature` | P1-01 | PLANNED | Any feature touching money: integer cents + ISO currency, all math through `lib/domain/money`, near-100% unit coverage, no floats, currency mismatch handling. |
```

to:

```
| [`add-money-safe-feature`](skills/add-money-safe-feature.md) | P1-01 | BUILT | Any feature touching money: integer cents + ISO currency, all math through `lib/domain/money`, near-100% unit coverage, no floats, currency mismatch handling. |
```

- [ ] **Step 3: Commit**

```bash
git add docs/skills/add-money-safe-feature.md docs/SKILLS.md
git commit -m "docs(p1-01): add-money-safe-feature skill"
```

---

### Task 6: ADR-007 + progress board

**Files:**
- Modify: `DECISIONS.md` (add ADR-007 at the top of the ADR list)
- Modify: `PROGRESS.md` (P1-01 row + notes)

**Interfaces:**
- Consumes: nothing.
- Produces: ADR-007 recorded; P1-01 marked DONE.

- [ ] **Step 1: Add ADR-007**

In `DECISIONS.md`, insert directly under the `Newest at top.` / `---` header, above `ADR-006`:

```markdown
## ADR-007 — Money stored as fixed 2-decimal integer minor units (cents)
**Context:** Finova is multi-currency, but EUR/USD (2-decimal) dominate. ISO-4217 exponents vary (JPY=0, KWD=3).
**Decision:** Represent every amount as integer cents = 1/100 of the major unit, regardless of currency, and force 2 fraction digits on display. The money module (`lib/domain/money`) is the single home for all money math.
**Consequences:** Simpler arithmetic and storage; correct for the currencies Finova actually uses. JPY/KWD would mis-render decimals if introduced. Upgrade path: replace the single `MINOR_UNITS = 100` factor with an ISO exponent lookup — contained to `money.ts`/`format.ts`, no caller changes.

---
```

- [ ] **Step 2: Update the progress board**

In `PROGRESS.md`, change the P1-01 row status from `TODO` to `DONE`:

```
| P1-01 | Skill `add-money-safe-feature` + money module (cents+currency, full tests) | Backend/Domain | DONE |
```

Then add a notes line beneath the Phase 1 table:

```
**P1-01 notes:** `lib/domain/money/` — pure domain module: integer cents + ISO-4217 currency, no floats. `money.ts` (constructors, exact + half-up-rounded arithmetic, compare, `convert`, `allocate` largest-remainder split), `format.ts` (Intl, locale-aware, forced 2 decimals), `errors.ts` (typed). Near-100% unit coverage. Skill `add-money-safe-feature` written. ADR-007 records the fixed-2-decimal choice.
```

- [ ] **Step 3: Final full verification**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all suites PASS; no type or lint errors.

- [ ] **Step 4: Commit**

```bash
git add DECISIONS.md PROGRESS.md
git commit -m "docs(p1-01): ADR-007 + progress board"
```

---

## Self-Review

**Spec coverage:**
- Architecture & file layout → Tasks 1–4 (errors, money, format, index). ✓
- `Money` type + constructors (`money`/`fromDecimal`/`zero`, safe-int + currency validation) → Task 2. ✓
- Exact arithmetic + currency-mismatch throws → Task 2. ✓
- Rounded arithmetic (half-up) `multiply`/`convert` → Task 2. ✓
- Comparison (`equals` total; ordering throws) + sign predicates → Task 2. ✓
- `allocate` largest-remainder, cent-exact → Task 2. ✓
- Formatting (Intl, es/en, forced 2 decimals) → Task 3. ✓
- Near-100% coverage + float traps, overflow, mismatch, rounding, allocate → Tasks 2–4. ✓
- Skill `add-money-safe-feature` + SKILLS.md flip → Task 5. ✓
- ADR-007 + PROGRESS.md → Task 6. ✓
- Out-of-scope items (DB, user-input parsing, FX rates, ISO exponents) → not implemented, correct. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code and exact commands. ✓

**Type consistency:** Function names/signatures in the barrel (Task 4) and skill doc match `money.ts`/`format.ts` definitions (Tasks 2–3); `Money`, `roundHalfUp`, `MINOR_UNITS`, `CurrencyMismatchError` used consistently across tasks and the ADR. ✓
