/**
 * Generic column-mapping engine for the import flow (P2-03).
 *
 * Turns the header-keyed records of an arbitrary bank CSV into normalized
 * {@link RawTxn} rows, given a user-supplied {@link ColumnMapping}. Pure and
 * fully unit-tested — no I/O, no DB. Reuses the locale parsers (`locale-parse`),
 * the money module (signed integer cents), and the FNV-1a hash from
 * `fingerprint.ts` for the template lookup key.
 *
 * Per-row failures never throw: a bad date/amount, an empty description, or a
 * malformed currency yields a {@link RowError} (the row is dropped from the
 * output) while every valid row still parses. That error list is what feeds the
 * P2-07 new/dup/error review screen later.
 */

import { fromDecimal } from '../money'
import type { RawTxn } from './adapter'
import { fnv1a } from './fingerprint'
import {
  type DecimalSeparator,
  parseDateToIso,
  parseDecimalToCanonical,
} from './locale-parse'

export type DateFormat = 'dmy' | 'mdy' | 'ymd' | 'auto'

export interface DateMapping {
  column: string
  format?: DateFormat
}

export type AmountMapping =
  | {
      kind: 'single'
      column: string
      decimal?: DecimalSeparator
      /** Which sign the source uses for outflows; flip to invert. */
      negativeIs: 'expense' | 'income'
    }
  | {
      kind: 'debitCredit'
      debitColumn: string
      creditColumn: string
      decimal?: DecimalSeparator
    }

export type CurrencyMapping = { column: string } | { fixed: string }

export interface ColumnMapping {
  amount: AmountMapping
  currency?: CurrencyMapping
  date: DateMapping
  description: { column: string }
  note?: { column: string }
}

export interface RowError {
  field: string
  raw: string
  reason: string
  rowIndex: number
}

const CURRENCY_RE = /^[A-Z]{3}$/

/**
 * A stable lookup key for a file's layout: normalized headers (trim, lowercase,
 * strip accents, collapse whitespace), joined in order, FNV-1a hashed. Header
 * order is part of a bank's layout identity, so the signature is order-sensitive.
 */
export function headerSignature(headers: string[]): string {
  const normalized = headers.map(normalizeHeader).join('|')
  return fnv1a(normalized)
}

/**
 * Canonicalize a header for comparison: strip accents, lowercase, collapse
 * whitespace, trim. Used by {@link headerSignature} and by adapters' header
 * detection (`defineMappingAdapter`) so recognition is accent/case-tolerant.
 */
export function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining accent marks
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Map header-keyed records to {@link RawTxn} rows using `mapping`. Returns the
 * parsed rows and a list of per-row {@link RowError}s; a row that errors is
 * omitted from `rows` but never aborts the batch. At most one error is reported
 * per row, at the first failing field (date → amount → description → currency).
 */
export function applyMapping(
  records: Record<string, string>[],
  mapping: ColumnMapping
): { rows: RawTxn[]; errors: RowError[] } {
  const rows: RawTxn[] = []
  const errors: RowError[] = []

  records.forEach((record, rowIndex) => {
    const result = mapRow(record, mapping, rowIndex)
    if ('error' in result) {
      errors.push(result.error)
    } else {
      rows.push(result.row)
    }
  })

  return { rows, errors }
}

type RowResult = { row: RawTxn } | { error: RowError }

function mapRow(
  record: Record<string, string>,
  mapping: ColumnMapping,
  rowIndex: number
): RowResult {
  const err = (field: string, raw: string, reason: string): RowResult => ({
    error: { rowIndex, field, raw, reason },
  })

  // date
  const rawDate = (record[mapping.date.column] ?? '').trim()
  const occurredAt = parseDateToIso(rawDate, mapping.date.format ?? 'auto')
  if (!occurredAt) {
    return err('date', rawDate, 'invalidDate')
  }

  // amount (signed integer cents)
  const amount = mapAmount(record, mapping.amount)
  if ('error' in amount) {
    return err('amount', amount.raw, amount.reason)
  }

  // description (required, non-empty)
  const description = (record[mapping.description.column] ?? '').trim()
  if (description === '') {
    return err('description', description, 'descriptionRequired')
  }

  const row: RawTxn = {
    amountCents: amount.cents,
    description,
    occurredAt,
  }

  // note (optional)
  if (mapping.note) {
    const note = (record[mapping.note.column] ?? '').trim()
    if (note !== '') {
      row.note = note
    }
  }

  // currency (optional; validated when present)
  if (mapping.currency) {
    const rawCurrency = (
      'fixed' in mapping.currency
        ? mapping.currency.fixed
        : (record[mapping.currency.column] ?? '')
    ).trim()
    if (rawCurrency !== '') {
      const currency = rawCurrency.toUpperCase()
      if (!CURRENCY_RE.test(currency)) {
        return err('currency', rawCurrency, 'invalidCurrency')
      }
      row.currency = currency
    }
  }

  return { row }
}

type AmountResult =
  | { cents: number }
  | { error: true; raw: string; reason: string }

function mapAmount(
  record: Record<string, string>,
  mapping: AmountMapping
): AmountResult {
  if (mapping.kind === 'single') {
    const raw = (record[mapping.column] ?? '').trim()
    const cents = toCents(raw, mapping.decimal)
    if (cents === null) {
      return { error: true, raw, reason: 'invalidAmount' }
    }
    const sign = mapping.negativeIs === 'expense' ? 1 : -1
    return { cents: cents * sign }
  }

  // debit/credit: exactly one column populated per row.
  const debit = (record[mapping.debitColumn] ?? '').trim()
  const credit = (record[mapping.creditColumn] ?? '').trim()
  const hasDebit = debit !== ''
  const hasCredit = credit !== ''
  if (hasDebit === hasCredit) {
    return {
      error: true,
      raw: `${debit}|${credit}`,
      reason: hasDebit ? 'bothDebitAndCredit' : 'noDebitOrCredit',
    }
  }
  const raw = hasDebit ? debit : credit
  const magnitude = toCents(raw, mapping.decimal)
  if (magnitude === null) {
    return { error: true, raw, reason: 'invalidAmount' }
  }
  // Debit → expense (negative), credit → income (positive). The source columns
  // hold magnitudes; the column itself carries the sign.
  return { cents: hasDebit ? -Math.abs(magnitude) : Math.abs(magnitude) }
}

/**
 * Parse a localized amount string to signed integer cents via the locale parser
 * and the money module, or `null` if it isn't a number. The currency is
 * irrelevant to the cents math (fixed 100 minor units, ADR-007), so a constant
 * placeholder is used — `RawTxn.currency` is resolved separately.
 */
function toCents(raw: string, decimal?: DecimalSeparator): number | null {
  const canonical = parseDecimalToCanonical(raw, decimal ? { decimal } : {})
  if (canonical === null) {
    return null
  }
  return fromDecimal(Number(canonical), 'EUR').amount
}
