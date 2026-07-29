import 'server-only'
import type {
  ExportInput,
  InvestmentsExportInput,
  RealEstateExportInput,
} from '@finova/domain/export/bundle'
import { applyFilters } from '@finova/domain/transactions/apply-filters'
import {
  EMPTY_FILTERS,
  type TransactionFilters,
} from '@finova/domain/transactions/filters'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import { accountRowSchema } from '@/lib/validation/account'
import { categorizationRuleRowSchema } from '@/lib/validation/categorization-rule'
import { categoryRowSchema } from '@/lib/validation/category'
import { debtRowSchema } from '@/lib/validation/debts'
import { importTemplateRowSchema } from '@/lib/validation/import-template'
import {
  assetRowSchema,
  investmentAccountRowSchema,
  investmentTransactionRowSchema,
  portfolioRowSchema,
} from '@/lib/validation/investments'
import {
  propertyExpenseRowSchema,
  propertyRowSchema,
  propertyValuationRowSchema,
  rentalIncomeRowSchema,
} from '@/lib/validation/real-estate'
import { transactionRowSchema } from '@/lib/validation/transaction'

/**
 * Export read layer (P4-05). RLS-enforced read of the user's data — every
 * query goes through the Supabase server client, so a user only ever exports
 * their own rows. Filters (export filters spec, 2026-07-03) narrow the
 * transactions query only; accounts and categories always export in full so
 * JSON references stay resolvable. Transactions are ordered oldest-first so
 * the exported ledger reads chronologically.
 */
export async function getExportData(
  filters: TransactionFilters = EMPTY_FILTERS
): Promise<ExportInput> {
  await requireUser()
  const supabase = await createClient()

  const [accountsRes, categoriesRes, txnsRes, rulesRes, templatesRes] =
    await Promise.all([
      supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: true }),
      supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true }),
      applyFilters(supabase.from('transactions').select('*'), filters).order(
        'occurred_at',
        { ascending: true }
      ),
      supabase
        .from('categorization_rules')
        .select('*')
        .order('priority', { ascending: true }),
      supabase
        .from('import_templates')
        .select('*')
        .order('created_at', { ascending: true }),
    ])

  if (accountsRes.error) throw new Error(accountsRes.error.message)
  if (categoriesRes.error) throw new Error(categoriesRes.error.message)
  if (txnsRes.error) throw new Error(txnsRes.error.message)
  if (rulesRes.error) throw new Error(rulesRes.error.message)
  if (templatesRes.error) throw new Error(templatesRes.error.message)

  return {
    accounts: accountRowSchema.array().parse(accountsRes.data),
    categories: categoryRowSchema.array().parse(categoriesRes.data),
    transactions: transactionRowSchema.array().parse(txnsRes.data),
    rules: categorizationRuleRowSchema.array().parse(rulesRes.data),
    importTemplates: importTemplateRowSchema.array().parse(templatesRes.data),
  }
}

/**
 * Investments export read (Spec A). RLS-scoped. Only user-owned rows travel:
 * portfolios, investment accounts, and investment transactions. Assets are a
 * shared table, so we carry only the minimal reference for the assets the
 * user's transactions actually cite (resolved by symbol on import) — never the
 * whole shared catalog or provider cache columns.
 */
export async function getInvestmentsExportData(): Promise<InvestmentsExportInput> {
  await requireUser()
  const supabase = await createClient()

  const [portfoliosRes, accountsRes, txnsRes] = await Promise.all([
    supabase
      .from('portfolios')
      .select('*')
      .order('created_at', { ascending: true }),
    supabase
      .from('investment_accounts')
      .select('*')
      .order('created_at', { ascending: true }),
    supabase
      .from('investment_transactions')
      .select('*')
      .order('traded_at', { ascending: true }),
  ])
  if (portfoliosRes.error) throw new Error(portfoliosRes.error.message)
  if (accountsRes.error) throw new Error(accountsRes.error.message)
  if (txnsRes.error) throw new Error(txnsRes.error.message)

  const transactions = investmentTransactionRowSchema
    .array()
    .parse(txnsRes.data)
  const assetIds = [...new Set(transactions.map((t) => t.asset_id))]

  let assets: InvestmentsExportInput['assets'] = []
  if (assetIds.length > 0) {
    const assetsRes = await supabase
      .from('assets')
      .select('*')
      .in('id', assetIds)
    if (assetsRes.error) throw new Error(assetsRes.error.message)
    assets = assetRowSchema
      .array()
      .parse(assetsRes.data)
      .map((a) => ({
        id: a.id,
        type: a.type,
        ticker: a.ticker,
        isin: a.isin,
        coingecko_id: a.coingecko_id,
        exchange: a.exchange,
        name: a.name,
        currency: a.currency,
      }))
  }

  return {
    portfolios: portfolioRowSchema.array().parse(portfoliosRes.data),
    accounts: investmentAccountRowSchema.array().parse(accountsRes.data),
    assets,
    transactions,
  }
}

/**
 * Real-estate export read (Spec A). RLS-scoped read of all five user-owned
 * tables; each row parsed through its zod schema. Parents and children travel
 * together so a property's loans/valuations/income/expenses stay resolvable.
 */
export async function getRealEstateExportData(): Promise<RealEstateExportInput> {
  await requireUser()
  const supabase = await createClient()

  const [propsRes, loansRes, valsRes, incomeRes, expensesRes] =
    await Promise.all([
      supabase
        .from('properties')
        .select('*')
        .order('purchase_date', { ascending: true }),
      supabase
        .from('debts')
        .select('*')
        .eq('type', 'mortgage')
        .order('start_date', { ascending: true }),
      supabase
        .from('property_valuations')
        .select('*')
        .order('valuation_date', { ascending: true }),
      supabase
        .from('rental_income')
        .select('*')
        .order('period_start', { ascending: true }),
      supabase
        .from('property_expenses')
        .select('*')
        .order('expense_date', { ascending: true }),
    ])
  if (propsRes.error) throw new Error(propsRes.error.message)
  if (loansRes.error) throw new Error(loansRes.error.message)
  if (valsRes.error) throw new Error(valsRes.error.message)
  if (incomeRes.error) throw new Error(incomeRes.error.message)
  if (expensesRes.error) throw new Error(expensesRes.error.message)

  return {
    properties: propertyRowSchema.array().parse(propsRes.data),
    loans: debtRowSchema.array().parse(loansRes.data),
    valuations: propertyValuationRowSchema.array().parse(valsRes.data),
    income: rentalIncomeRowSchema.array().parse(incomeRes.data),
    expenses: propertyExpenseRowSchema.array().parse(expensesRes.data),
  }
}
