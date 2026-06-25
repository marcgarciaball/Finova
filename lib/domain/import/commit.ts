import type { RawTxn } from './adapter'
import { transactionFingerprint } from './fingerprint'

/**
 * Pure commit-row builder for the import flow (P2-08).
 *
 * The single place that knows the `transactions` insert shape for imports.
 * Mirrors `review.ts`'s `fingerprintOf` exactly so a committed row
 * re-fingerprints to the value `existingFingerprintsForAccount` recomputes —
 * that identity is what makes re-import idempotent. No I/O; fully unit-tested.
 */

/** Rows per chunk for the action's chunked idempotent upsert. */
export const CHUNK_SIZE = 500

export interface CommitContext {
  accountId: string
  /** `category_id | null` per input row, index-aligned (from the seam). */
  categoryIds: (string | null)[]
  /** Account currency (falling back to profile base) for rows without their own. */
  fallbackCurrency: string
  userId: string
}

/** The exact shape inserted into `transactions` for an imported row. */
export interface CommitRow {
  account_id: string
  amount_cents: number
  category_id: string | null
  currency: string
  description: string
  import_fingerprint: string
  is_recurring: boolean
  is_transfer: boolean
  note: string | null
  occurred_at: string
  tags: string[]
  user_id: string
}

export function buildCommitRows(
  newTxns: RawTxn[],
  ctx: CommitContext
): CommitRow[] {
  return newTxns.map((txn, i) => ({
    user_id: ctx.userId,
    account_id: ctx.accountId,
    category_id: ctx.categoryIds[i] ?? null,
    amount_cents: txn.amountCents,
    currency: txn.currency ?? ctx.fallbackCurrency,
    // UTC midnight: re-fingerprints identically to existingFingerprintsForAccount.
    occurred_at: `${txn.occurredAt}T00:00:00.000Z`,
    description: txn.description,
    note: txn.note ?? null,
    tags: [],
    is_recurring: false,
    is_transfer: false,
    import_fingerprint: transactionFingerprint({
      accountId: ctx.accountId,
      amountCents: txn.amountCents,
      description: txn.description,
      occurredAt: txn.occurredAt,
    }),
  }))
}
