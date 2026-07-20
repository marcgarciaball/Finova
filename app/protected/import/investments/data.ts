import 'server-only'
import { requireUser } from '@/lib/auth/require-user'
import {
  accountFingerprint,
  assetKey,
  investmentTxnFingerprint,
  portfolioFingerprint,
} from '@/lib/domain/import/backup/investments-fingerprint'
import type { ExistingInvestments } from '@/lib/domain/import/backup/investments-plan'
import { createClient } from '@/lib/supabase/server'

/**
 * Snapshot of the user's current investments fingerprints (Spec C). RLS server
 * client. Portfolios/accounts fingerprint from content; transaction
 * fingerprints need the asset's symbol key, so referenced assets are read and
 * keyed the same way the import does. Numerics are coerced with `Number` so a
 * Postgres string ("10.00000000") matches an incoming number (10).
 */
export async function getInvestmentsFingerprints(): Promise<ExistingInvestments> {
  await requireUser()
  const supabase = await createClient()

  const [portfolios, accounts, txns] = await Promise.all([
    supabase.from('portfolios').select('id, name, base_currency'),
    supabase
      .from('investment_accounts')
      .select('id, portfolio_id, name, currency'),
    supabase
      .from('investment_transactions')
      .select(
        'portfolio_id, account_id, asset_id, type, traded_at, quantity, price_cents, currency'
      ),
  ])
  for (const res of [portfolios, accounts, txns]) {
    if (res.error) throw new Error(res.error.message)
  }

  const portfolioIdByFp = new Map<string, string>()
  const fpByPortfolioId = new Map<string, string>()
  for (const p of portfolios.data ?? []) {
    const fp = portfolioFingerprint({
      name: String(p.name),
      base_currency: String(p.base_currency),
    })
    portfolioIdByFp.set(fp, String(p.id))
    fpByPortfolioId.set(String(p.id), fp)
  }

  const accountIdByFp = new Map<string, string>()
  for (const a of accounts.data ?? []) {
    const parentFp = fpByPortfolioId.get(String(a.portfolio_id))
    if (!parentFp) continue
    const fp = accountFingerprint(parentFp, {
      name: String(a.name),
      currency: String(a.currency),
    })
    accountIdByFp.set(fp, String(a.id))
  }

  // Asset symbol keys for the assets these transactions reference.
  const rows = txns.data ?? []
  const assetIds = [...new Set(rows.map((r) => String(r.asset_id)))]
  const symbolByAssetId = new Map<string, string>()
  if (assetIds.length > 0) {
    const { data: assetRows, error } = await supabase
      .from('assets')
      .select('id, ticker, isin, coingecko_id, exchange, name')
      .in('id', assetIds)
    if (error) throw new Error(error.message)
    for (const a of assetRows ?? []) {
      symbolByAssetId.set(
        String(a.id),
        assetKey({
          ticker: a.ticker as string | null,
          isin: a.isin as string | null,
          coingecko_id: a.coingecko_id as string | null,
          exchange: a.exchange as string | null,
          name: String(a.name),
        })
      )
    }
  }

  const txnFps = new Set<string>()
  for (const r of rows) {
    const parentFp = fpByPortfolioId.get(String(r.portfolio_id))
    const symbol = symbolByAssetId.get(String(r.asset_id))
    if (!parentFp || !symbol) continue
    txnFps.add(
      investmentTxnFingerprint(parentFp, symbol, {
        type: String(r.type) as 'buy' | 'sell',
        traded_at: String(r.traded_at),
        quantity: Number(r.quantity),
        price_cents: Number(r.price_cents),
        currency: String(r.currency),
      })
    )
  }

  return { portfolioIdByFp, accountIdByFp, txnFps }
}
