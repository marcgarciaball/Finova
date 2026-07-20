'use server'

import {
  commitInvestmentsBackup,
  reviewInvestmentsBackup,
} from '@/app/protected/import/investments/actions'
import {
  commitRealEstateBackup,
  reviewRealEstateBackup,
} from '@/app/protected/import/real-estate/actions'
import {
  commitTransactionsBackup,
  reviewTransactionsBackup,
} from '@/app/protected/import/transactions/actions'

/**
 * "Everything" restore (Spec D). Fans out to each domain importer over the same
 * file and aggregates per-domain totals. A domain simply absent from the file is
 * not an error (its "no<Domain>" code maps to zeros); a genuine parse failure
 * (malformed / notFinova / unsupportedVersion) from any domain aborts the whole
 * restore. Domains are independent (no cross-references), so commit order is
 * irrelevant. Idempotent throughout, so a partial retry is safe.
 */

type Domain = 'transactions' | 'investments' | 'realEstate'

interface TableCounts {
  duplicate: number
  error: number
  new: number
}

const ZERO: TableCounts = { new: 0, duplicate: 0, error: 0 }
// Per-domain "this domain isn't in the file" codes — treated as skip, not error.
const ABSENT = new Set(['noTransactions', 'noInvestments', 'noRealEstate'])

export type EverythingReviewResult =
  | { ok: true; counts: Record<Domain, TableCounts>; totals: TableCounts }
  | { ok: false; error: string }

export type EverythingCommitResult =
  | {
      ok: true
      counts: Record<Domain, TableCounts>
      committed: number
      skipped: number
      errors: number
    }
  | { ok: false; error: string }

type DomainResult =
  | { ok: true; totals: TableCounts }
  | { ok: false; error: string }

/** Fold a domain action's result: absent → zeros, hard error → propagate. */
function fold(
  r: { ok: true; totals: TableCounts } | { ok: false; error: string }
): DomainResult {
  if (r.ok) return { ok: true, totals: r.totals }
  if (ABSENT.has(r.error)) return { ok: true, totals: ZERO }
  return { ok: false, error: r.error }
}

function aggregate(counts: Record<Domain, TableCounts>): {
  present: boolean
  totals: TableCounts
} {
  const totals = Object.values(counts).reduce(
    (acc, c) => ({
      new: acc.new + c.new,
      duplicate: acc.duplicate + c.duplicate,
      error: acc.error + c.error,
    }),
    { ...ZERO }
  )
  const present = totals.new + totals.duplicate + totals.error > 0
  return { present, totals }
}

export async function reviewEverythingBackup(input: {
  fileText: string
}): Promise<EverythingReviewResult> {
  const [tx, inv, re] = await Promise.all([
    reviewTransactionsBackup(input),
    reviewInvestmentsBackup(input),
    reviewRealEstateBackup(input),
  ])
  const folded = {
    transactions: fold(tx),
    investments: fold(inv),
    realEstate: fold(re),
  }
  for (const f of Object.values(folded)) {
    if (!f.ok) return { ok: false, error: f.error }
  }
  const counts: Record<Domain, TableCounts> = {
    transactions: folded.transactions.ok ? folded.transactions.totals : ZERO,
    investments: folded.investments.ok ? folded.investments.totals : ZERO,
    realEstate: folded.realEstate.ok ? folded.realEstate.totals : ZERO,
  }
  const { present, totals } = aggregate(counts)
  if (!present) return { ok: false, error: 'empty' }
  return { ok: true, counts, totals }
}

export async function commitEverythingBackup(input: {
  fileText: string
}): Promise<EverythingCommitResult> {
  const [tx, inv, re] = await Promise.all([
    commitTransactionsBackup(input),
    commitInvestmentsBackup(input),
    commitRealEstateBackup(input),
  ])
  const results = { transactions: tx, investments: inv, realEstate: re }
  const counts = { ...({} as Record<Domain, TableCounts>) }
  for (const [domain, r] of Object.entries(results) as [
    Domain,
    typeof tx | typeof inv | typeof re,
  ][]) {
    if (r.ok) {
      counts[domain] = {
        new: r.committed,
        duplicate: r.skipped,
        error: r.errors,
      }
    } else if (ABSENT.has(r.error)) {
      counts[domain] = { ...ZERO }
    } else {
      return { ok: false, error: r.error }
    }
  }
  const { totals } = aggregate(counts)
  return {
    ok: true,
    counts,
    committed: totals.new,
    skipped: totals.duplicate,
    errors: totals.error,
  }
}
