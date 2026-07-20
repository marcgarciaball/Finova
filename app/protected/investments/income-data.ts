import 'server-only'
import {
  type DividendEvent,
  type DividendTxn,
  dividendsByYearCents,
  dividendsReceivedCents,
  dividendsReceivedEvents,
  quantityHeldOn,
  trailing12mPerShareCents,
} from '@finova/domain/investments/dividends'
import { computeHolding } from '@finova/domain/investments/holdings'
import {
  convertCents,
  type FxRateTable,
  fxKey,
} from '@finova/domain/investments/portfolio'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import { getOrCreatePortfolio } from './data'

/**
 * Dividend income view (Inversiones Phase C). Everything is computed live
 * from the transaction log + synced dividend_events; per-event amounts are
 * in the asset's native currency, totals convert to the portfolio base.
 */

export interface AssetIncome {
  currency: string
  forwardAnnualCents: number // trailing-12M per share × current quantity
  name: string
  quantity: number
  receivedCents: number // all-time, native currency
  ticker: string
  trailing12mPerShareCents: number
  yieldOnCostPct: number | null // trailing-12M per share / avg cost
}

export interface UpcomingPayment {
  currency: string
  estimatedCents: number
  payDate: string
  ticker: string
}

export interface InvestmentsIncome {
  baseCurrency: string
  byYearBaseCents: { cents: number; year: string }[]
  forwardAnnualBaseCents: number
  hasEvents: boolean
  perAsset: AssetIncome[]
  portfolioYieldOnCostPct: number | null
  /** Every received dividend as a dated cash event, in base cents — lets
   * callers (e.g. the dashboard income breakdown) filter by period. */
  receivedEventsBase: { cents: number; date: string }[]
  totalReceivedBaseCents: number
  upcoming: UpcomingPayment[]
}

export async function getInvestmentsIncome(): Promise<InvestmentsIncome> {
  await requireUser()
  const portfolio = await getOrCreatePortfolio()
  const base = portfolio.base_currency
  const supabase = await createClient()
  const todayIso = new Date().toISOString().slice(0, 10)

  const { data: txnData, error: txnError } = await supabase
    .from('investment_transactions')
    .select(
      'asset_id, type, quantity, price_cents, fees_cents, currency, traded_at'
    )
  if (txnError) {
    throw new Error(txnError.message)
  }
  const byAsset = new Map<
    string,
    {
      currency: string
      txns: (DividendTxn & { feesCents: number; priceCents: number })[]
    }
  >()
  for (const r of txnData ?? []) {
    const id = String(r.asset_id)
    const entry = byAsset.get(id) ?? { currency: String(r.currency), txns: [] }
    entry.txns.push({
      feesCents: Number(r.fees_cents),
      priceCents: Number(r.price_cents),
      quantity: Number(r.quantity),
      tradedAt: String(r.traded_at),
      type: r.type === 'sell' ? 'sell' : 'buy',
    })
    byAsset.set(id, entry)
  }
  const assetIds = [...byAsset.keys()]
  const empty: InvestmentsIncome = {
    baseCurrency: base,
    byYearBaseCents: [],
    forwardAnnualBaseCents: 0,
    hasEvents: false,
    perAsset: [],
    portfolioYieldOnCostPct: null,
    receivedEventsBase: [],
    totalReceivedBaseCents: 0,
    upcoming: [],
  }
  if (assetIds.length === 0) {
    return empty
  }

  const [assetRes, eventRes, fxRes] = await Promise.all([
    supabase.from('assets').select('id, name, ticker').in('id', assetIds),
    supabase
      .from('dividend_events')
      .select('asset_id, ex_date, pay_date, amount_per_share')
      .in('asset_id', assetIds)
      .order('ex_date', { ascending: true }),
    supabase
      .from('fx_rates')
      .select('from_ccy, to_ccy, rate, rate_date')
      .order('rate_date', { ascending: true }),
  ])
  const assetMeta = new Map(
    (assetRes.data ?? []).map((a) => [
      String(a.id),
      {
        name: String(a.name),
        ticker: a.ticker == null ? '' : String(a.ticker),
      },
    ])
  )
  const rates: FxRateTable = new Map(
    (fxRes.data ?? []).map((r) => [
      fxKey(String(r.from_ccy), String(r.to_ccy)),
      Number(r.rate),
    ])
  )
  const eventsByAsset = new Map<string, DividendEvent[]>()
  for (const r of eventRes.data ?? []) {
    const id = String(r.asset_id)
    const list = eventsByAsset.get(id) ?? []
    list.push({
      amountPerShare: Number(r.amount_per_share),
      exDate: String(r.ex_date),
      payDate: r.pay_date == null ? null : String(r.pay_date),
    })
    eventsByAsset.set(id, list)
  }
  if (eventsByAsset.size === 0) {
    return empty
  }

  const toBase = (cents: number, ccy: string): number | null =>
    ccy === base || rates.has(fxKey(ccy, base))
      ? convertCents(cents, ccy, base, rates)
      : null

  const perAsset: AssetIncome[] = []
  const upcoming: UpcomingPayment[] = []
  const byYearBase = new Map<string, number>()
  const receivedEventsBase: { cents: number; date: string }[] = []
  let totalReceivedBaseCents = 0
  let forwardAnnualBaseCents = 0
  let investedBaseCents = 0

  for (const [assetId, { currency, txns }] of byAsset) {
    const events = eventsByAsset.get(assetId) ?? []
    const meta = assetMeta.get(assetId)
    const holding = computeHolding(txns.map((t) => ({ ...t, currency })))
    const receivedCents = dividendsReceivedCents(txns, events)
    const t12 = trailing12mPerShareCents(events, todayIso)
    const forwardAnnualCents = Math.round(t12 * holding.quantity)

    if (receivedCents > 0 || forwardAnnualCents > 0) {
      perAsset.push({
        currency,
        forwardAnnualCents,
        name: meta?.name ?? '',
        quantity: holding.quantity,
        receivedCents,
        ticker: meta?.ticker ?? '',
        trailing12mPerShareCents: t12,
        yieldOnCostPct:
          holding.avgCostCents > 0 ? (t12 / holding.avgCostCents) * 100 : null,
      })
    }
    totalReceivedBaseCents += toBase(receivedCents, currency) ?? 0
    forwardAnnualBaseCents += toBase(forwardAnnualCents, currency) ?? 0
    investedBaseCents += toBase(holding.investedCents, currency) ?? 0

    for (const ev of dividendsReceivedEvents(txns, events)) {
      const converted = toBase(ev.cents, currency)
      if (converted !== null) {
        receivedEventsBase.push({ cents: converted, date: ev.date })
      }
    }

    for (const [year, cents] of Object.entries(
      dividendsByYearCents(txns, events)
    )) {
      const converted = toBase(cents, currency)
      if (converted !== null) {
        byYearBase.set(year, (byYearBase.get(year) ?? 0) + converted)
      }
    }
    for (const e of events) {
      if (e.payDate && e.payDate > todayIso) {
        const held = quantityHeldOn(txns, e.exDate)
        if (held > 0) {
          upcoming.push({
            currency,
            estimatedCents: Math.round(held * e.amountPerShare * 100),
            payDate: e.payDate,
            ticker: meta?.ticker ?? '',
          })
        }
      }
    }
  }

  perAsset.sort((a, b) => b.forwardAnnualCents - a.forwardAnnualCents)
  upcoming.sort((a, b) => a.payDate.localeCompare(b.payDate))

  return {
    baseCurrency: base,
    byYearBaseCents: [...byYearBase.entries()]
      .map(([year, cents]) => ({ cents, year }))
      .sort((a, b) => a.year.localeCompare(b.year)),
    forwardAnnualBaseCents,
    hasEvents: true,
    perAsset,
    portfolioYieldOnCostPct:
      investedBaseCents > 0
        ? (forwardAnnualBaseCents / investedBaseCents) * 100
        : null,
    receivedEventsBase: receivedEventsBase.sort((a, b) =>
      a.date.localeCompare(b.date)
    ),
    totalReceivedBaseCents,
    upcoming,
  }
}
