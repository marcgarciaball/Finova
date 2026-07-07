import 'server-only'
import { requireUser } from '@/lib/auth/require-user'
import {
  computePortfolioTotals,
  convertCents,
  type FxRateTable,
  fxKey,
  type PortfolioTotals,
  type ValuedHolding,
} from '@/lib/domain/investments/portfolio'
import {
  buildHoldingRows,
  type RebuildTxn,
} from '@/lib/domain/investments/rebuild'
import type { AssetType } from '@/lib/domain/investments/types'
import { createClient } from '@/lib/supabase/server'
import { getOrCreatePortfolio } from './data'

/**
 * Live portfolio overview (Inversiones Phase B). Holdings are computed
 * on-request from the user's transaction log + shared cached_quotes — always
 * consistent with what the user just entered, independent of when the A5 job
 * last rebuilt the `holdings` table (which serves snapshots/cron use).
 */

export interface HoldingView {
  assetId: string
  assetType: AssetType
  avgCostCents: number
  currency: string
  currentPriceCents: number | null
  currentValueCents: number | null
  investedCents: number
  name: string
  quantity: number
  realizedPlCents: number
  stale: boolean
  ticker: string
  unrealizedPlCents: number | null
  unrealizedPlPct: number | null
}

export interface HistoryPoint {
  date: string
  investedCents: number
  valueCents: number | null // snapshot value when one exists for that day
}

export interface InvestmentsOverview {
  baseCurrency: string
  hasTransactions: boolean
  history: HistoryPoint[]
  holdings: HoldingView[] // open positions only (quantity > 0)
  latestFetchedAt: string | null
  realizedPlBaseCents: number
  staleCount: number
  totals: PortfolioTotals
  unconvertibleCount: number // priced, but no FX rate to base yet
  unpricedCount: number
}

const EMPTY_TOTALS: PortfolioTotals = {
  allocationByCurrency: {},
  allocationByType: {},
  pricedInvestedCents: 0,
  totalInvestedCents: 0,
  totalPlCents: 0,
  totalPlPct: null,
  totalValueCents: 0,
  unpricedCount: 0,
}

export async function getInvestmentsOverview(): Promise<InvestmentsOverview> {
  await requireUser()
  const portfolio = await getOrCreatePortfolio()
  const base = portfolio.base_currency
  const supabase = await createClient()

  const { data: txnData, error: txnError } = await supabase
    .from('investment_transactions')
    .select(
      'user_id, portfolio_id, asset_id, type, quantity, price_cents, fees_cents, currency, traded_at'
    )
  if (txnError) {
    throw new Error(txnError.message)
  }
  const txns: RebuildTxn[] = (txnData ?? []).map((r) => ({
    assetId: String(r.asset_id),
    currency: String(r.currency),
    feesCents: Number(r.fees_cents),
    portfolioId: String(r.portfolio_id),
    priceCents: Number(r.price_cents),
    quantity: Number(r.quantity),
    tradedAt: String(r.traded_at),
    type: r.type === 'sell' ? 'sell' : 'buy',
    userId: String(r.user_id),
  }))
  if (txns.length === 0) {
    return {
      baseCurrency: base,
      hasTransactions: false,
      history: [],
      holdings: [],
      latestFetchedAt: null,
      realizedPlBaseCents: 0,
      staleCount: 0,
      totals: EMPTY_TOTALS,
      unconvertibleCount: 0,
      unpricedCount: 0,
    }
  }

  const assetIds = [...new Set(txns.map((t) => t.assetId))]
  const [assetRes, quoteRes, fxRes, snapshotRes] = await Promise.all([
    supabase.from('assets').select('id, name, ticker, type').in('id', assetIds),
    supabase
      .from('cached_quotes')
      .select('asset_id, price_cents, currency, stale, fetched_at')
      .in('asset_id', assetIds),
    supabase
      .from('fx_rates')
      .select('from_ccy, to_ccy, rate, rate_date')
      .order('rate_date', { ascending: true }),
    supabase
      .from('portfolio_snapshots')
      .select('snapshot_date, total_value_cents')
      .order('snapshot_date', { ascending: true }),
  ])
  const assetMeta = new Map(
    (assetRes.data ?? []).map((a) => [
      String(a.id),
      {
        name: String(a.name),
        ticker: a.ticker == null ? '' : String(a.ticker),
        type: String(a.type) as AssetType,
      },
    ])
  )
  const quoteMeta = new Map(
    (quoteRes.data ?? []).map((q) => [
      String(q.asset_id),
      {
        currency: String(q.currency),
        fetchedAt: String(q.fetched_at),
        priceCents: Number(q.price_cents),
        stale: Boolean(q.stale),
      },
    ])
  )
  // Later rate_date rows overwrite earlier ones → the map holds latest rates.
  const rates: FxRateTable = new Map(
    (fxRes.data ?? []).map((r) => [
      fxKey(String(r.from_ccy), String(r.to_ccy)),
      Number(r.rate),
    ])
  )

  const { rows } = buildHoldingRows(
    txns,
    new Map(
      [...quoteMeta].map(([id, q]) => [
        id,
        { currency: q.currency, priceCents: q.priceCents },
      ])
    )
  )

  const holdings: HoldingView[] = []
  let realizedPlBaseCents = 0
  let unconvertibleCount = 0
  const valued: ValuedHolding[] = []
  for (const r of rows) {
    const meta = assetMeta.get(r.asset_id)
    const quote = quoteMeta.get(r.asset_id)
    const txnCurrency =
      txns.find((t) => t.assetId === r.asset_id)?.currency ?? base
    const convertible =
      txnCurrency === base || rates.has(fxKey(txnCurrency, base))
    if (convertible) {
      realizedPlBaseCents += convertCents(
        r.realized_pl_cents,
        txnCurrency,
        base,
        rates
      )
      valued.push({
        assetType: meta?.type ?? 'stock',
        currency: txnCurrency,
        currentValueCents: r.quantity > 0 ? r.current_value_cents : null,
        investedCents: r.invested_cents,
        unrealizedPlPct: r.unrealized_pl_pct,
      })
    } else {
      unconvertibleCount += 1
    }
    if (r.quantity > 0) {
      holdings.push({
        assetId: r.asset_id,
        assetType: meta?.type ?? 'stock',
        avgCostCents: r.avg_cost_cents,
        currency: txnCurrency,
        currentPriceCents: r.current_price_cents,
        currentValueCents: r.current_value_cents,
        investedCents: r.invested_cents,
        name: meta?.name ?? '',
        quantity: r.quantity,
        realizedPlCents: r.realized_pl_cents,
        stale: quote?.stale ?? false,
        ticker: meta?.ticker ?? '',
        unrealizedPlCents: r.unrealized_pl_cents,
        unrealizedPlPct: r.unrealized_pl_pct,
      })
    }
  }
  holdings.sort(
    (a, b) => (b.currentValueCents ?? 0) - (a.currentValueCents ?? 0)
  )

  const fetchTimes = holdings
    .map((h) => quoteMeta.get(h.assetId)?.fetchedAt)
    .filter((v): v is string => Boolean(v))
    .sort()

  // Contributions over time (buys add cost, sells remove proceeds), merged
  // with the daily value snapshots the refresh job records.
  const investedByDate = new Map<string, number>()
  let cumInvested = 0
  for (const txn of [...txns].sort((a, b) =>
    a.tradedAt.localeCompare(b.tradedAt)
  )) {
    const gross = Math.round(txn.quantity * txn.priceCents)
    const delta =
      txn.type === 'buy' ? gross + txn.feesCents : -(gross - txn.feesCents)
    const convertible =
      txn.currency === base || rates.has(fxKey(txn.currency, base))
    if (convertible) {
      cumInvested += convertCents(delta, txn.currency, base, rates)
      investedByDate.set(txn.tradedAt, cumInvested)
    }
  }
  const valueByDate = new Map(
    (snapshotRes.data ?? []).map((r) => [
      String(r.snapshot_date),
      Number(r.total_value_cents),
    ])
  )
  const historyDates = [
    ...new Set([...investedByDate.keys(), ...valueByDate.keys()]),
  ].sort()
  let carried = 0
  const history: HistoryPoint[] = historyDates.map((date) => {
    carried = investedByDate.get(date) ?? carried
    return {
      date,
      investedCents: carried,
      valueCents: valueByDate.get(date) ?? null,
    }
  })

  return {
    baseCurrency: base,
    hasTransactions: true,
    history,
    holdings,
    latestFetchedAt: fetchTimes.at(-1) ?? null,
    realizedPlBaseCents,
    staleCount: holdings.filter((h) => h.stale).length,
    totals: computePortfolioTotals(valued, base, rates),
    unconvertibleCount,
    unpricedCount: holdings.filter((h) => h.currentPriceCents === null).length,
  }
}
