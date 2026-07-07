'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { getBaseCurrency } from '@/app/protected/accounts/data'
import { getOrCreatePortfolio } from '@/app/protected/investments/data'
import { requireUser } from '@/lib/auth/require-user'
import {
  computeHolding,
  type HoldingTxn,
  OversellError,
} from '@/lib/domain/investments/holdings'
import type { AssetType } from '@/lib/domain/investments/types'
import {
  type AssetOption,
  assetOptionSchema,
  type ResolvedAsset,
} from '@/lib/investments/asset-option'
import {
  getFinnhubStockProfile,
  ProviderError,
  searchSymbol,
} from '@/lib/investments/providers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  createInvestmentTransactionSchema,
  parseAmountToCents,
} from '@/lib/validation/investment-transaction'
import { assetRowSchema } from '@/lib/validation/investments'

/**
 * Server actions for the Inversiones screen (A4).
 *
 * `requireUser()` first everywhere; user rows are keyed by verified
 * `claims.sub`. The shared `assets` table has no user write policies — its
 * upserts go through the service-role admin client after validation here.
 */

const INVESTMENTS_PATH = '/protected/investments'

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

export type SearchResult =
  | { ok: true; results: AssetOption[] }
  | { ok: false; error: string }

export type ResolveResult =
  | { ok: true; asset: ResolvedAsset }
  | { ok: false; error: string }

/** First message per field, for inline form errors. */
function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !(key in out)) {
      out[key] = issue.message
    }
  }
  return out
}

const UNEXPECTED = 'unexpected'

/**
 * Type-ahead search: the shared `assets` table first (instant, no provider
 * quota), the provider only when nothing is known locally.
 */
export async function searchAssets(
  query: string,
  assetType: AssetType
): Promise<SearchResult> {
  await requireUser()
  const q = query
    .trim()
    .slice(0, 50)
    .replace(/[%,()]/g, '')
  if (q.length < 1) {
    return { ok: true, results: [] }
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('assets')
    .select('*')
    .eq('type', assetType)
    .or(`ticker.ilike.%${q}%,name.ilike.%${q}%`)
    .limit(8)

  const local = assetRowSchema.array().safeParse(data ?? [])
  if (local.success && local.data.length > 0) {
    return {
      ok: true,
      results: local.data.map((a) => ({
        assetId: a.id,
        assetType: a.type,
        coingeckoId: a.coingecko_id,
        currency: a.currency,
        exchange: a.exchange,
        name: a.name,
        ticker: a.ticker ?? '',
      })),
    }
  }

  try {
    const results = await searchSymbol(q, assetType)
    return {
      ok: true,
      results: results.slice(0, 8).map((r) => ({
        assetId: null,
        assetType: r.assetType,
        coingeckoId: r.coingeckoId,
        currency: r.currency,
        exchange: r.exchange,
        name: r.name,
        ticker: r.ticker,
      })),
    }
  } catch {
    return { ok: false, error: 'searchFailed' }
  }
}

/**
 * Turn a picked search hit into a persisted asset the form can reference.
 * Known assets are read back; provider hits are enriched (listed assets via
 * Finnhub profile2 — /search carries no currency/exchange) and upserted via
 * the admin client.
 */
export async function resolveAsset(
  option: AssetOption
): Promise<ResolveResult> {
  await requireUser()
  const parsed = assetOptionSchema.safeParse(option)
  if (!parsed.success) {
    console.error('resolveAsset: option validation failed', parsed.error.issues)
    return { ok: false, error: 'assetResolve' }
  }
  const opt = parsed.data

  try {
    if (opt.assetId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('id', opt.assetId)
        .single()
      if (error) {
        console.error('resolveAsset: read of known asset failed', error)
        return { ok: false, error: 'assetResolve' }
      }
      const row = assetRowSchema.parse(data)
      return {
        ok: true,
        asset: {
          currency: row.currency,
          id: row.id,
          name: row.name,
          ticker: row.ticker ?? '',
          type: row.type,
        },
      }
    }

    const baseCurrency = await getBaseCurrency()
    const admin = createAdminClient()

    let upsert: Record<string, unknown>
    let onConflict: string
    if (opt.assetType === 'crypto') {
      if (!opt.coingeckoId) {
        return { ok: false, error: 'assetResolve' }
      }
      // Crypto has no native fiat currency; quote in the user's base currency.
      upsert = {
        coingecko_id: opt.coingeckoId,
        currency: baseCurrency,
        name: opt.name,
        ticker: opt.ticker,
        type: 'crypto',
      }
      onConflict = 'coingecko_id'
    } else {
      let currency = baseCurrency
      let exchange: string | null = null
      let isin: string | null = null
      let meta: Record<string, unknown> = {}
      let name = opt.name
      try {
        const profile = await getFinnhubStockProfile(opt.ticker)
        currency = profile.currency ?? baseCurrency
        exchange = profile.exchange
        isin = profile.isin
        meta = profile.raw
        name = profile.name
      } catch (e) {
        // Profile coverage is imperfect; keep the search identity and fall
        // back to the base currency rather than blocking the add.
        if (!(e instanceof ProviderError)) {
          throw e
        }
      }
      upsert = {
        currency,
        exchange,
        isin,
        name,
        provider_meta: meta,
        ticker: opt.ticker,
        type: opt.assetType,
      }
      onConflict = 'ticker,exchange'
    }

    const { data, error } = await admin
      .from('assets')
      .upsert(upsert, { onConflict })
      .select()
      .single()
    if (error) {
      console.error('resolveAsset: asset upsert failed', error)
      return { ok: false, error: 'assetResolve' }
    }
    const row = assetRowSchema.parse(data)
    return {
      ok: true,
      asset: {
        currency: row.currency,
        id: row.id,
        name: row.name,
        ticker: row.ticker ?? '',
        type: row.type,
      },
    }
  } catch (e) {
    console.error('resolveAsset: unexpected failure', e)
    return { ok: false, error: 'assetResolve' }
  }
}

export async function addInvestmentTransaction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const claims = await requireUser()

  const parsed = createInvestmentTransactionSchema.safeParse({
    assetId: formData.get('assetId'),
    currency: formData.get('currency'),
    fees: formData.get('fees') || undefined,
    notes: formData.get('notes') ?? undefined,
    price: formData.get('price'),
    quantity: formData.get('quantity'),
    tradedAt: formData.get('tradedAt'),
    type: formData.get('type'),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validationFailed',
      fieldErrors: toFieldErrors(parsed.error),
    }
  }
  const input = parsed.data

  try {
    const priceCents = parseAmountToCents(input.price, input.currency)
    const feesCents = parseAmountToCents(input.fees, input.currency)
    const supabase = await createClient()

    // Currency-consistency and oversell guards against the existing log.
    const { data: existing, error: readError } = await supabase
      .from('investment_transactions')
      .select('type, quantity, price_cents, fees_cents, currency, traded_at')
      .eq('asset_id', input.assetId)
    if (readError) {
      return { ok: false, error: UNEXPECTED }
    }
    const prior: HoldingTxn[] = (existing ?? []).map((r) => ({
      currency: String(r.currency),
      feesCents: Number(r.fees_cents),
      priceCents: Number(r.price_cents),
      quantity: Number(r.quantity),
      tradedAt: String(r.traded_at),
      type: r.type === 'sell' ? 'sell' : 'buy',
    }))
    if (prior.some((t) => t.currency !== input.currency)) {
      return {
        ok: false,
        error: 'validationFailed',
        fieldErrors: { currency: 'mixedCurrency' },
      }
    }
    if (input.type === 'sell') {
      try {
        computeHolding([
          ...prior,
          {
            currency: input.currency,
            feesCents,
            priceCents,
            quantity: Number(input.quantity),
            tradedAt: input.tradedAt,
            type: 'sell',
          },
        ])
      } catch (e) {
        if (e instanceof OversellError) {
          return {
            ok: false,
            error: 'validationFailed',
            fieldErrors: { quantity: 'oversell' },
          }
        }
        throw e
      }
    }

    const portfolio = await getOrCreatePortfolio()
    const { error } = await supabase.from('investment_transactions').insert({
      asset_id: input.assetId,
      currency: input.currency,
      fees_cents: feesCents,
      notes: input.notes ?? null,
      portfolio_id: portfolio.id,
      price_cents: priceCents,
      quantity: input.quantity, // decimal string → numeric(20,8), no float trip
      traded_at: input.tradedAt,
      type: input.type,
      user_id: claims.sub,
    })
    if (error) {
      return { ok: false, error: UNEXPECTED }
    }
  } catch {
    return { ok: false, error: UNEXPECTED }
  }

  revalidatePath(INVESTMENTS_PATH)
  return { ok: true }
}
