import 'server-only'
import { z } from 'zod'
import { getBaseCurrency } from '@/app/protected/accounts/data'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import {
  investmentTransactionRowSchema,
  type PortfolioRow,
  portfolioRowSchema,
} from '@/lib/validation/investments'

/**
 * Read layer for the Inversiones screen (A4). RLS-scoped user client
 * throughout; the shared `assets` table is readable by any authenticated
 * user (reference data).
 */

/**
 * The user's portfolio, created on first visit (multi-portfolio is
 * schema-ready; the UI starts with one). Base currency seeds from the
 * profile's reporting currency.
 */
export async function getOrCreatePortfolio(): Promise<PortfolioRow> {
  const claims = await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) {
    throw new Error(error.message)
  }
  if (data) {
    return portfolioRowSchema.parse(data)
  }

  const baseCurrency = await getBaseCurrency()
  const { data: created, error: insertError } = await supabase
    .from('portfolios')
    .insert({ base_currency: baseCurrency, user_id: claims.sub })
    .select()
    .single()
  if (insertError) {
    throw new Error(insertError.message)
  }
  return portfolioRowSchema.parse(created)
}

const txnWithAssetSchema = investmentTransactionRowSchema.extend({
  assets: z.object({
    name: z.string(),
    ticker: z.string().nullable(),
    type: z.string(),
  }),
})
export type InvestmentTransactionWithAsset = z.infer<typeof txnWithAssetSchema>

/** The full transaction log, newest first, with the asset embedded for display. */
export async function listInvestmentTransactions(): Promise<
  InvestmentTransactionWithAsset[]
> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('investment_transactions')
    .select('*, assets(name, ticker, type)')
    .order('traded_at', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) {
    throw new Error(error.message)
  }
  return txnWithAssetSchema.array().parse(data)
}
