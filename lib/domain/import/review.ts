import type { RawTxn } from './adapter'
import {
  type FuzzyOptions,
  isFuzzyDuplicate,
  transactionFingerprint,
} from './fingerprint'
import { applyMapping, type ColumnMapping, type RowError } from './mapping'

/** The headline verdict for a single parsed row. */
export type RowStatus = 'new' | 'duplicate' | 'error'

export interface ReviewRow {
  /** Present when status === 'error'. */
  error?: RowError
  /** Advisory near-dup flag on an otherwise-'new' row; does not affect counts. */
  fuzzy?: boolean
  /** 1-based original record index, for display. */
  index: number
  status: RowStatus
  /** Present when status !== 'error'. */
  txn?: RawTxn
}

export interface ReviewResult {
  counts: { new: number; duplicate: number; error: number }
  rows: ReviewRow[]
}

export interface ReviewOptions {
  fuzzy?: FuzzyOptions
  /** Existing transactions (same account) used for the fuzzy near-dup pass. */
  seenTxns?: RawTxn[]
}

/** A RawTxn-shaped key for transactionFingerprint (accountId + the row fields). */
function fingerprintOf(accountId: string, txn: RawTxn): string {
  return transactionFingerprint({
    accountId,
    amountCents: txn.amountCents,
    description: txn.description,
    occurredAt: txn.occurredAt,
  })
}

/**
 * Classify every record as new / duplicate / error against the chosen account.
 * Exact duplicates (deterministic fingerprint) drive the headline counts;
 * fuzzy near-dups are an advisory badge on otherwise-'new' rows. Pure: no I/O.
 */
export function reviewRows(
  records: Record<string, string>[],
  mapping: ColumnMapping,
  accountId: string,
  existingFingerprints: ReadonlySet<string>,
  options: ReviewOptions = {}
): ReviewResult {
  const { rows, errors } = applyMapping(records, mapping)

  // Build a map from rowIndex → RowError for ordering the output by original index.
  const errorMap = new Map<number, RowError>()
  for (const error of errors) {
    errorMap.set(error.rowIndex, error)
  }

  const out: ReviewRow[] = []
  const seen = new Set<string>()
  // Bucket existing + batch-seen txns for fuzzy Levenshtein comparison.
  const fuzzyPool: RawTxn[] = [...(options.seenTxns ?? [])]

  // We need to reconstruct the original record order. applyMapping processes
  // in order, so we track which indices produced rows vs errors.
  let rowCursor = 0

  for (let i = 0; i < records.length; i++) {
    const errorForRow = errorMap.get(i)
    if (errorForRow !== undefined) {
      out.push({ index: i + 1, status: 'error', error: errorForRow })
      continue
    }

    const txn = rows[rowCursor++]
    if (txn === undefined) {
      // Should not happen if applyMapping is correct, but guard for safety.
      continue
    }

    const fp = fingerprintOf(accountId, txn)
    let status: RowStatus
    if (existingFingerprints.has(fp) || seen.has(fp)) {
      status = 'duplicate'
    } else {
      status = 'new'
      seen.add(fp)
    }

    const row: ReviewRow = { index: i + 1, status, txn }
    if (status === 'new') {
      const fuzzy = fuzzyPool.some((other) =>
        isFuzzyDuplicate(
          {
            accountId,
            amountCents: txn.amountCents,
            description: txn.description,
            occurredAt: txn.occurredAt,
          },
          {
            accountId,
            amountCents: other.amountCents,
            description: other.description,
            occurredAt: other.occurredAt,
          },
          options.fuzzy
        )
      )
      if (fuzzy) {
        row.fuzzy = true
      }
    }
    fuzzyPool.push(txn)
    out.push(row)
  }

  const counts = {
    new: out.filter((r) => r.status === 'new').length,
    duplicate: out.filter((r) => r.status === 'duplicate').length,
    error: errors.length,
  }
  return { counts, rows: out }
}
