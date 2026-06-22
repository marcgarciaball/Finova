# P1-01 — Money module + `add-money-safe-feature` skill (design)

**Date:** 2026-06-22
**Ticket:** P1-01 (Phase 1 — Core data model & money safety)
**Owner:** Backend/Domain
**Status:** Approved design — ready for implementation plan

## Goal

A pure, fully-tested domain module that is the **single home for all money math** in
Finova: integer minor units + ISO-4217 currency, never floats, currency-mismatch
handling, near-100% unit coverage. Plus the reusable skill `add-money-safe-feature`
that codifies the rules so every future money-touching feature routes through this
module.

This ticket ships **no DB and no UI** — it is the primitive the rest of Phase 1
(accounts, transactions, transfers, multi-currency) builds on.

## Decisions (locked during brainstorming)

| # | Decision | Choice | Note |
|---|----------|--------|------|
| 1 | Decimal places per currency | **Assume 2 decimals always** (1/100 minor units) | Documented trade-off — see ADR-007. JPY (0) / KWD (3) would render with 2 decimals. Upgrade path isolated to one constant. |
| 2 | Internal amount type | **`number`, guarded as a safe integer** | ±2^53 ≈ ±€90 trillion of headroom; JSON-friendly; throws on non-integer / unsafe values. |
| 3 | Currency conversion | **Include a pure `convert` primitive** | Multiply by a caller-supplied rate + round; no rate-fetching (that is P1-07). |
| 4 | Rounding (multiply/convert) | **Half-up, away from zero** (2.5→3, −2.5→−3), plus `allocate()` | Add/subtract/compare are always exact; rounding only arises in multiply/convert. |

## Architecture

A pure domain module — no DB, no React, no I/O, no `process.env`. Functions over
plain data, trivially unit-testable, importable from server actions, importers, and
UI alike.

```
lib/domain/money/
  money.ts      # Money type, constructors, arithmetic, comparison, convert, allocate
  format.ts     # locale-aware formatting (Intl) — separate so core math has zero Intl dependency
  errors.ts     # CurrencyMismatchError, InvalidAmountError, InvalidCurrencyError
  index.ts      # barrel (public API)
  money.test.ts
  format.test.ts
```

**Why split `money.ts` from `format.ts`:** core math must never depend on locale or
`Intl`. Keeping presentation separate means a formatting change cannot break
arithmetic, and the math module stays dependency-free.

## The `Money` type & constructors

```ts
type Money = {
  readonly amount: number   // integer minor units (cents); validated safe integer
  readonly currency: string // ISO-4217, uppercase, e.g. "EUR"
}
```

Constructors (all validate; throw typed errors on bad input):

- `money(cents: number, currency: string): Money` — primary constructor.
  - throws `InvalidAmountError` if `amount` is not a safe integer.
  - throws `InvalidCurrencyError` if `currency` does not match `^[A-Z]{3}$`.
- `fromDecimal(value: number, currency: string): Money` — major units → cents
  (e.g. `12.34 → 1234`). Rounds half-up to defeat float artifacts such as
  `0.1 * 100 = 10.000000000000002`.
- `zero(currency: string): Money`.

## Operations (all pure; return a new `Money`)

**Exact (no rounding):**
- `add(a, b)`, `subtract(a, b)` — throw `CurrencyMismatchError` when currencies differ.
- `negate(m)`, `abs(m)`.

**Rounded (half-up, away from zero):**
- `multiply(m, factor: number)` — `round(amount * factor)`.
- `convert(m, targetCurrency, rate: number)` — pure: `round(amount * rate)` in the
  new currency. No rate source (P1-07 supplies rates).

**Comparison:**
- `equals(a, b)`, `compare(a, b): -1 | 0 | 1`, `greaterThan(a, b)`, `lessThan(a, b)`.
- `isZero(m)`, `isPositive(m)`, `isNegative(m)`.
- Comparisons across differing currencies throw `CurrencyMismatchError`
  (`equals` returns `false` for differing currencies rather than throwing — equality
  is a total function; ordering is not).

**Allocation:**
- `allocate(m, weights: number[]): Money[]` — split an amount across weights using the
  **largest-remainder** method, so the parts always sum back to exactly the original
  (no cent lost or created). Weights must be non-negative and not all zero.

## Formatting (`format.ts`)

- `format(m: Money, locale: string): string` — `Intl.NumberFormat(locale, { style:
  'currency', currency: m.currency, minimumFractionDigits: 2, maximumFractionDigits: 2
  })` applied to `amount / 100`. Forcing 2 fraction digits keeps display consistent
  with the fixed-2-decimal model (decision #1). Localized symbol + grouping
  (`€1.234,56` in `es`, `$1,234.56` in `en`).
- Default app locale is `es` (matches `profiles.locale` default).

Locale-aware **parsing** of free-form user input (e.g. `"1.234,56"`) is **out of
scope** here — it belongs with the transactions UI (P1-05). `fromDecimal` covers
programmatic construction.

## Errors (`errors.ts`)

Typed error classes extending `Error`, each with a stable `name`:

- `CurrencyMismatchError` — carries both offending currency codes.
- `InvalidAmountError` — non-integer or unsafe amount.
- `InvalidCurrencyError` — malformed currency code.

## Testing (near-100% coverage)

Table-driven vitest in `money.test.ts` and `format.test.ts`:

- **Float traps:** `add(fromDecimal(0.1, 'EUR'), fromDecimal(0.2, 'EUR'))` === `0.30`.
- **Safe-integer guard:** `money(Number.MAX_SAFE_INTEGER + 1, …)` throws; non-integer throws.
- **Currency mismatch:** `add`/`subtract`/`compare`/ordering across currencies throw;
  `equals` of differing currencies is `false`.
- **Rounding boundaries:** half-up incl. negatives (`-2.5 → -3`), `multiply`, `convert`.
- **`allocate`:** remainder distribution sums back exactly; even and uneven weights;
  rejects all-zero / negative weights.
- **`convert`:** rate application + rounding; currency code changes.
- **Formatting:** `es` and `en` for positive, negative, and zero amounts.
- **Constructors / comparison / sign predicates:** full branch coverage.

## The skill `add-money-safe-feature`

`docs/skills/add-money-safe-feature.md`:

- **Trigger:** any feature touching money (amounts, balances, totals, splits, FX).
- **Rules:** integer minor units only; never floats for money; all math through
  `lib/domain/money`; throw on currency mismatch; near-100% coverage on new money logic.
- **Checklist** mapping to the ticket's Definition of Done.

Flip its row in `docs/SKILLS.md` from `PLANNED` → `BUILT` with `Built at: P1-01`.

## ADR-007 (to add to `DECISIONS.md`)

> **ADR-007 — Money stored as fixed 2-decimal integer minor units (cents)**
> **Context:** Finova is multi-currency, but EUR/USD (2-decimal) dominate. ISO-4217
> exponents vary (JPY=0, KWD=3).
> **Decision:** Represent every amount as integer cents = 1/100 of the major unit,
> regardless of currency, and force 2 fraction digits on display.
> **Consequences:** Simpler arithmetic and storage; correct for the currencies Finova
> actually uses. JPY/KWD would mis-render decimals if introduced. Upgrade path: replace
> the single `100` minor-unit factor with an ISO exponent lookup table — contained to
> `money.ts`/`format.ts`, no caller changes.

## Definition of Done

- [ ] `lib/domain/money/` module with the API above; no floats anywhere in money math.
- [ ] Currency mismatch throws on add/subtract/ordering; `equals` total.
- [ ] `allocate` is cent-exact; rounding is half-up incl. negatives.
- [ ] `format` localized (`es`/`en`), 2 fraction digits.
- [ ] Near-100% unit coverage; `npm test` green; `npm run typecheck` + `npm run lint` clean.
- [ ] `docs/skills/add-money-safe-feature.md` written; `docs/SKILLS.md` row → `BUILT`.
- [ ] ADR-007 added to `DECISIONS.md`; PROGRESS.md P1-01 → DONE.

## Out of scope (later tickets)

- DB columns / tables for amounts (P1-02+).
- Locale-aware parsing of user-typed amounts (P1-05).
- FX rate fetching + base/display-currency resolution (P1-07).
- ISO-correct per-currency exponents (deferred per ADR-007).
