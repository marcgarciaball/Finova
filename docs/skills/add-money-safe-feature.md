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
