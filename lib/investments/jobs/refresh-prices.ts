import 'server-only'
import { fxKey } from '@/lib/domain/investments/portfolio'
import {
  buildHoldingRows,
  type QuoteForRebuild,
  type RebuildTxn,
} from '@/lib/domain/investments/rebuild'
import {
  fetchDailyRates,
  fetchRateHistory,
  getCoinGeckoDailyPrices,
  getFmpDailyPrices,
  getFmpDividends,
  getQuote,
} from '@/lib/investments/providers'
import { createAdminClient } from '@/lib/supabase/admin'
import { assetRowSchema } from '@/lib/validation/investments'

/**
 * Price-refresh job (Inversiones A5). Triggered by the cron route handler
 * (manual trigger for now; Vercel Cron in Phase B). Runs entirely on the
 * service-role client: refreshes cached_quotes for every asset that appears
 * in any transaction log, rebuilds `holdings`, upserts today's portfolio
 * snapshots, and refreshes daily FX rates. Provider failures keep the last
 * cached quote and mark it stale — the dashboard never breaks.
 */

export interface RefreshSummary {
  dividendAssets: number
  fxPairs: number
  holdings: number
  quotesFailed: number
  quotesRefreshed: number
  skippedGroups: string[]
  snapshots: number
}

const CONCURRENCY = 5 // Finnhub free tier: 60/min

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = []
  let index = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) {
        const i = index++
        const item = items[i]
        if (item !== undefined) {
          out[i] = await fn(item)
        }
      }
    })
  )
  return out
}

export async function refreshPrices(): Promise<RefreshSummary> {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const today = now.slice(0, 10)

  // 1. Everything anyone holds (transactions are the source of truth).
  const { data: txnData, error: txnError } = await admin
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
  const heldAssetIds = [...new Set(txns.map((t) => t.assetId))]

  // 2. Refresh quotes (bounded concurrency; failures keep stale cache).
  let quotesRefreshed = 0
  let quotesFailed = 0
  const quotes = new Map<string, QuoteForRebuild>()
  if (heldAssetIds.length > 0) {
    const { data: assetData, error: assetError } = await admin
      .from('assets')
      .select('*')
      .in('id', heldAssetIds)
    if (assetError) {
      throw new Error(assetError.message)
    }
    const assets = assetRowSchema.array().parse(assetData ?? [])

    await mapLimit(assets, CONCURRENCY, async (asset) => {
      try {
        const quote = await getQuote({
          coingeckoId: asset.coingecko_id,
          currency: asset.currency,
          ticker: asset.ticker,
          type: asset.type,
        })
        const { error } = await admin.from('cached_quotes').upsert(
          {
            asset_id: asset.id,
            currency: quote.currency,
            fetched_at: quote.fetchedAt,
            price_cents: quote.priceCents,
            provider: asset.type === 'crypto' ? 'coingecko' : 'finnhub',
            quote_type: quote.quoteType,
            stale: false,
          },
          { onConflict: 'asset_id' }
        )
        if (error) {
          throw new Error(error.message)
        }
        quotes.set(asset.id, {
          currency: quote.currency,
          priceCents: quote.priceCents,
        })
        quotesRefreshed += 1
      } catch (e) {
        quotesFailed += 1
        console.error(`quote refresh failed for ${asset.id}:`, e)
        // Keep the previous cached price, but flag it.
        await admin
          .from('cached_quotes')
          .update({ stale: true })
          .eq('asset_id', asset.id)
      }
    })

    // Positions whose refresh failed still value against the stale cache.
    const { data: cachedData } = await admin
      .from('cached_quotes')
      .select('asset_id, price_cents, currency')
      .in('asset_id', heldAssetIds)
    for (const row of cachedData ?? []) {
      const id = String(row.asset_id)
      if (!quotes.has(id)) {
        quotes.set(id, {
          currency: String(row.currency),
          priceCents: Number(row.price_cents),
        })
      }
    }
  }

  // 2b. Slow-moving data (dividends, price history, FX history) syncs at
  // most once per day per asset: it lives in the database and every page
  // view reads it from there — provider quota is only spent on the daily
  // top-up. "Needs sync" = no stored daily close newer than yesterday.
  const { data: maxDates } = await admin
    .from('historical_prices')
    .select('asset_id, date')
    .in('asset_id', heldAssetIds.length > 0 ? heldAssetIds : ['-'])
    .order('date', { ascending: false })
  const latestByAsset = new Map<string, string>()
  for (const r of maxDates ?? []) {
    const id = String(r.asset_id)
    if (!latestByAsset.has(id)) {
      latestByAsset.set(id, String(r.date))
    }
  }
  const cutoff = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const needsSync = new Set(
    heldAssetIds.filter((id) => {
      const latest = latestByAsset.get(id)
      return latest === undefined || latest < cutoff
    })
  )

  let dividendAssets = 0
  if (process.env.FMP_API_KEY && needsSync.size > 0) {
    const { data: listedData } = await admin
      .from('assets')
      .select('id, ticker, currency, type')
      .in('id', [...needsSync])
      .neq('type', 'crypto')
    const listed = (listedData ?? []).filter((a) => a.ticker)
    await mapLimit(listed, 2, async (asset) => {
      try {
        const events = await getFmpDividends(String(asset.ticker))
        if (events.length === 0) {
          return
        }
        const { error } = await admin.from('dividend_events').upsert(
          events.map((e) => ({
            amount_per_share: e.amountPerShare,
            asset_id: asset.id,
            currency: asset.currency,
            ex_date: e.exDate,
            pay_date: e.payDate,
            provider: 'fmp',
          })),
          { onConflict: 'asset_id,ex_date' }
        )
        if (error) {
          throw new Error(error.message)
        }
        dividendAssets += 1
      } catch (e) {
        console.error(`dividend sync failed for ${asset.id}:`, e)
      }
    })
  }

  // 2c. Historical backfill so the evolution chart has real data: daily
  // closes per held asset (FMP for listed, CoinGecko for crypto — 365d cap)
  // and daily ECB rates per needed pair, from the first transaction onward.
  // Skipped for assets already current (max stored date within 3 days).
  if (needsSync.size > 0) {
    const firstTradedAt = txns.reduce(
      (min, t) => (t.tradedAt < min ? t.tradedAt : min),
      today
    )
    const { data: assetData2 } = await admin
      .from('assets')
      .select('id, ticker, coingecko_id, currency, type')
      .in('id', [...needsSync])
    const needing = assetData2 ?? []
    await mapLimit(needing, 2, async (asset) => {
      try {
        const assetFirst = txns
          .filter((t) => t.assetId === String(asset.id))
          .reduce((min, t) => (t.tradedAt < min ? t.tradedAt : min), today)
        let daily: { closeCents: number; date: string }[] = []
        if (asset.type === 'crypto' && asset.coingecko_id) {
          daily = await getCoinGeckoDailyPrices(
            String(asset.coingecko_id),
            String(asset.currency)
          )
        } else if (asset.ticker && process.env.FMP_API_KEY) {
          daily = await getFmpDailyPrices(String(asset.ticker))
        }
        const rows = daily
          .filter((d) => d.date >= assetFirst)
          .map((d) => ({
            asset_id: asset.id,
            close_cents: d.closeCents,
            currency: asset.currency,
            date: d.date,
          }))
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await admin
            .from('historical_prices')
            .upsert(rows.slice(i, i + 500), { onConflict: 'asset_id,date' })
          if (error) {
            throw new Error(error.message)
          }
        }
      } catch (e) {
        console.error(`price history backfill failed for ${asset.id}:`, e)
      }
    })

    // FX history for every (asset currency → portfolio base) pair.
    try {
      const { data: pfData } = await admin
        .from('portfolios')
        .select('base_currency')
      const baseSet = new Set(
        (pfData ?? []).map((p) => String(p.base_currency))
      )
      const ccySet = new Set(txns.map((t) => t.currency))
      const { data: fxMax } = await admin
        .from('fx_rates')
        .select('from_ccy, to_ccy, rate_date')
        .order('rate_date', { ascending: false })
        .limit(1000)
      const latestPair = new Map<string, string>()
      for (const r of fxMax ?? []) {
        const key = `${r.from_ccy}->${r.to_ccy}`
        if (!latestPair.has(key)) {
          latestPair.set(key, String(r.rate_date))
        }
      }
      for (const base of baseSet) {
        for (const ccy of ccySet) {
          if (ccy === base) {
            continue
          }
          const have = latestPair.get(`${ccy}->${base}`)
          const start = have && have > firstTradedAt ? have : firstTradedAt
          if (have && have >= cutoff) {
            continue
          }
          const history = await fetchRateHistory(ccy, [base], start, today)
          const rows = history.map((r) => ({
            from_ccy: r.fromCcy,
            rate: r.rate,
            rate_date: r.date,
            to_ccy: r.toCcy,
          }))
          for (let i = 0; i < rows.length; i += 500) {
            const { error } = await admin
              .from('fx_rates')
              .upsert(rows.slice(i, i + 500), {
                onConflict: 'from_ccy,to_ccy,rate_date',
              })
            if (error) {
              throw new Error(error.message)
            }
          }
        }
      }
    } catch (e) {
      console.error('fx history backfill failed:', e)
    }
  }

  // 3. Rebuild holdings (full replace: derived data, transactions are truth).
  const { rows, skipped } = buildHoldingRows(txns, quotes)
  const { error: clearError } = await admin
    .from('holdings')
    .delete()
    .not('id', 'is', null)
  if (clearError) {
    throw new Error(clearError.message)
  }
  if (rows.length > 0) {
    const { error } = await admin
      .from('holdings')
      .insert(rows.map((r) => ({ ...r, last_computed_at: now })))
    if (error) {
      throw new Error(error.message)
    }
  }

  // 4. Today's snapshot per portfolio, summed in the portfolio base currency.
  // Cross-currency positions need FX; refresh rates first for involved pairs.
  const { data: portfolioData, error: pfError } = await admin
    .from('portfolios')
    .select('id, user_id, base_currency')
  if (pfError) {
    throw new Error(pfError.message)
  }
  const portfolios = (portfolioData ?? []).map((p) => ({
    baseCurrency: String(p.base_currency),
    id: String(p.id),
    userId: String(p.user_id),
  }))

  const holdingCurrencies = new Set(
    rows
      .filter((r) => r.current_value_cents !== null)
      .map((r) => {
        const q = quotes.get(r.asset_id)
        return q ? q.currency : null
      })
      .filter((c): c is string => c !== null)
  )
  const bases = new Set(portfolios.map((p) => p.baseCurrency))

  let fxPairs = 0
  const rates = new Map<string, number>()
  for (const base of bases) {
    const targets = [...holdingCurrencies].filter((c) => c !== base)
    if (targets.length === 0) {
      continue
    }
    try {
      // Frankfurter direction: we need holdingCcy -> base, so query per pair
      // from each holding currency.
      for (const from of targets) {
        const daily = await fetchDailyRates(from, [base])
        for (const r of daily.rates) {
          rates.set(fxKey(r.fromCcy, r.toCcy), r.rate)
          const { error } = await admin.from('fx_rates').upsert(
            {
              from_ccy: r.fromCcy,
              rate: r.rate,
              rate_date: daily.rateDate,
              to_ccy: r.toCcy,
            },
            { onConflict: 'from_ccy,to_ccy,rate_date' }
          )
          if (!error) {
            fxPairs += 1
          }
        }
      }
    } catch (e) {
      console.error('fx refresh failed:', e)
    }
  }

  let snapshots = 0
  for (const portfolio of portfolios) {
    const own = rows.filter((r) => r.portfolio_id === portfolio.id)
    let total = 0
    let complete = true
    for (const r of own) {
      if (r.current_value_cents === null) {
        complete = false
        continue
      }
      const ccy = quotes.get(r.asset_id)?.currency ?? portfolio.baseCurrency
      if (ccy === portfolio.baseCurrency) {
        total += r.current_value_cents
      } else {
        const rate = rates.get(fxKey(ccy, portfolio.baseCurrency))
        if (rate === undefined) {
          complete = false
          continue
        }
        total += Math.round(r.current_value_cents * rate)
      }
    }
    // Only snapshot fully-priced portfolios — a partial total would record a
    // misleading dip in the evolution chart.
    if (own.length === 0 || !complete) {
      continue
    }
    const { error } = await admin.from('portfolio_snapshots').upsert(
      {
        base_currency: portfolio.baseCurrency,
        portfolio_id: portfolio.id,
        snapshot_date: today,
        total_value_cents: total,
        user_id: portfolio.userId,
      },
      { onConflict: 'portfolio_id,snapshot_date' }
    )
    if (!error) {
      snapshots += 1
    }
  }

  return {
    dividendAssets,
    fxPairs,
    holdings: rows.length,
    quotesFailed,
    quotesRefreshed,
    skippedGroups: skipped,
    snapshots,
  }
}
