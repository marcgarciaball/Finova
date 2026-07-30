'use server'

import type { AssetRef } from '@finova/domain/export/bundle'
import {
  type InvestmentsImportPlan,
  type InvestmentsTable,
  planInvestmentsImport,
  type TableCounts,
} from '@finova/domain/import/backup/investments-plan'
import { parseBackup } from '@finova/domain/import/backup/parse'
import { after } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { refreshPrices } from '@/lib/investments/jobs/refresh-prices'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getInvestmentsFingerprints } from './data'

/**
 * Investments round-trip import (Spec C). Mirrors the real-estate importer, with
 * one extra step: transactions reference a shared `assets` row, so each asset is
 * resolved to a real DB id — matched or admin-upserted by symbol (the carried
 * ref has everything needed, so no provider calls). After committing, holdings
 * and history are rebuilt by the existing price-refresh job (transactions are
 * the source of truth), kicked off after the response.
 */

export type InvestmentsReviewResult =
  | {
      ok: true
      counts: Record<InvestmentsTable, TableCounts>
      totals: TableCounts
    }
  | { ok: false; error: string }

export type InvestmentsCommitResult =
  | {
      ok: true
      counts: Record<InvestmentsTable, TableCounts>
      committed: number
      skipped: number
      errors: number
    }
  | { ok: false; error: string }

function sumCounts(counts: Record<InvestmentsTable, TableCounts>): TableCounts {
  return Object.values(counts).reduce(
    (acc, c) => ({
      new: acc.new + c.new,
      duplicate: acc.duplicate + c.duplicate,
      error: acc.error + c.error,
    }),
    { new: 0, duplicate: 0, error: 0 }
  )
}

async function planFromFile(
  fileText: string
): Promise<
  { ok: true; plan: InvestmentsImportPlan } | { ok: false; error: string }
> {
  let raw: unknown
  try {
    raw = JSON.parse(fileText)
  } catch {
    return { ok: false, error: 'malformed' }
  }
  const parsed = parseBackup(raw)
  if (!parsed.ok) return { ok: false, error: parsed.error.code }
  if (!parsed.data.investments) return { ok: false, error: 'noInvestments' }

  const existing = await getInvestmentsFingerprints()
  const plan = planInvestmentsImport(parsed.data.investments, existing)
  return { ok: true, plan }
}

export async function reviewInvestmentsBackup(input: {
  fileText: string
}): Promise<InvestmentsReviewResult> {
  await requireUser()
  try {
    const result = await planFromFile(input.fileText)
    if (!result.ok) return { ok: false, error: result.error }
    return {
      ok: true,
      counts: result.plan.counts,
      totals: sumCounts(result.plan.counts),
    }
  } catch {
    return { ok: false, error: 'unexpected' }
  }
}

/** Match-or-create a shared asset by symbol; returns its DB id (or null). */
async function resolveAssetId(
  admin: ReturnType<typeof createAdminClient>,
  ref: AssetRef
): Promise<string | null> {
  let payload: Record<string, unknown>
  let onConflict: string
  if (ref.coingecko_id) {
    payload = {
      coingecko_id: ref.coingecko_id,
      currency: ref.currency,
      name: ref.name,
      ticker: ref.ticker,
      type: 'crypto',
    }
    onConflict = 'coingecko_id'
  } else if (ref.ticker) {
    payload = {
      ticker: ref.ticker,
      exchange: ref.exchange,
      isin: ref.isin,
      currency: ref.currency,
      name: ref.name,
      type: ref.type,
      provider_meta: {},
    }
    onConflict = 'ticker,exchange'
  } else {
    return null // no reliable identity (no ticker or coingecko id)
  }

  const { data, error } = await admin
    .from('assets')
    .upsert(payload, { onConflict })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return String(data.id)
}

export async function commitInvestmentsBackup(input: {
  fileText: string
}): Promise<InvestmentsCommitResult> {
  const claims = await requireUser()
  const userId = claims.sub
  try {
    const result = await planFromFile(input.fileText)
    if (!result.ok) return { ok: false, error: result.error }
    const { plan } = result
    const supabase = await createClient()

    // 1. Portfolios.
    const portfolioFpToId = new Map<string, string>()
    for (const p of plan.portfolios) {
      if (p.status === 'duplicate' && p.existingId) {
        portfolioFpToId.set(p.fp, p.existingId)
      }
    }
    const newPortfolios = plan.portfolios.filter((p) => p.status === 'new')
    if (newPortfolios.length > 0) {
      const { data, error } = await supabase
        .from('portfolios')
        .insert(
          newPortfolios.map((p) => ({
            user_id: userId,
            name: p.row.name,
            base_currency: p.row.base_currency,
            import_fingerprint: p.fp,
          }))
        )
        .select('id, import_fingerprint')
      if (error) throw new Error(error.message)
      for (const row of data ?? []) {
        if (row.import_fingerprint) {
          portfolioFpToId.set(String(row.import_fingerprint), String(row.id))
        }
      }
    }

    // 2. Accounts (need a resolved portfolio id).
    const accountFpToId = new Map<string, string>()
    for (const a of plan.accounts) {
      if (a.status === 'duplicate' && a.existingId) {
        accountFpToId.set(a.fp, a.existingId)
      }
    }
    const newAccounts = plan.accounts.filter(
      (a) => a.status === 'new' && portfolioFpToId.has(a.parentPortfolioFp)
    )
    if (newAccounts.length > 0) {
      const { data, error } = await supabase
        .from('investment_accounts')
        .insert(
          newAccounts.map((a) => ({
            user_id: userId,
            portfolio_id: portfolioFpToId.get(a.parentPortfolioFp) as string,
            name: a.row.name,
            currency: a.row.currency,
            import_fingerprint: a.fp,
          }))
        )
        .select('id, import_fingerprint')
      if (error) throw new Error(error.message)
      for (const row of data ?? []) {
        if (row.import_fingerprint) {
          accountFpToId.set(String(row.import_fingerprint), String(row.id))
        }
      }
    }

    // 3. Resolve the assets the new transactions reference.
    const admin = createAdminClient()
    const assetExportIdToId = new Map<string, string>()
    const neededAssetIds = new Set(
      plan.transactions.map((t) => t.assetExportId)
    )
    const resolvedAssetIds = await Promise.all(
      Array.from(neededAssetIds).map(async (exportId) => {
        const ref = plan.assetsByExportId.get(exportId)
        if (!ref) return null
        const id = await resolveAssetId(admin, ref)
        return id ? ([exportId, id] as const) : null
      })
    )
    for (const entry of resolvedAssetIds) {
      if (entry) assetExportIdToId.set(entry[0], entry[1])
    }

    // 4. Transactions (portfolio + asset must resolve).
    const txnRows = plan.transactions.flatMap((t) => {
      if (
        !portfolioFpToId.has(t.parentPortfolioFp) ||
        !assetExportIdToId.has(t.assetExportId)
      ) {
        return []
      }
      return [
        {
          user_id: userId,
          portfolio_id: portfolioFpToId.get(t.parentPortfolioFp) as string,
          account_id:
            t.accountFp && accountFpToId.has(t.accountFp)
              ? (accountFpToId.get(t.accountFp) as string)
              : null,
          asset_id: assetExportIdToId.get(t.assetExportId) as string,
          type: t.row.type,
          quantity: t.row.quantity,
          price_cents: t.row.price_cents,
          currency: t.row.currency,
          fees_cents: t.row.fees_cents,
          traded_at: t.row.traded_at,
          notes: t.row.notes,
          import_fingerprint: t.fp,
        },
      ]
    })
    if (txnRows.length > 0) {
      const { error } = await supabase
        .from('investment_transactions')
        .insert(txnRows)
      if (error) throw new Error(error.message)
    }

    // Rebuild holdings/history from the transaction log after the response.
    after(async () => {
      try {
        await refreshPrices()
      } catch (e) {
        console.error('post-import investments sync failed:', e)
      }
    })

    const totals = sumCounts(plan.counts)
    return {
      ok: true,
      counts: plan.counts,
      committed: totals.new,
      skipped: totals.duplicate,
      errors: totals.error,
    }
  } catch {
    return { ok: false, error: 'unexpected' }
  }
}
