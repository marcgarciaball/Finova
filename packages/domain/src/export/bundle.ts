/**
 * Export bundle assembly (P4-05). Pure — turns RLS-fetched rows into the two
 * export artifacts:
 *
 *  - `transactionsCsv` — the human-readable ledger, built on the P4-05 `toCsv`
 *    serializer so it stays formula-injection-safe (P2-09) and round-trips back
 *    through the P2-03 import parser. Amounts are emitted in **major units** as
 *    numbers (verbatim, exact) so the import decimal parser reads them back at
 *    the right scale and a leading `-` is never mis-sanitized as a formula.
 *  - `buildJsonBundle` — the full relational dataset (accounts + categories +
 *    transactions) plus a meta header. `exportedAt` is injected by the caller so
 *    the core never reads the clock.
 */

import type { AccountRow } from '@/lib/validation/account'
import type { CategorizationRuleRow } from '@/lib/validation/categorization-rule'
import type { CategoryRow } from '@/lib/validation/category'
import type { DebtRow } from '@/lib/validation/debts'
import type { ImportTemplateRow } from '@/lib/validation/import-template'
import type {
  InvestmentAccountRow,
  InvestmentTransactionRow,
  PortfolioRow,
} from '@/lib/validation/investments'
import type {
  PropertyExpenseRow,
  PropertyRow,
  PropertyValuationRow,
  RentalIncomeRow,
} from '@/lib/validation/real-estate'
import type { TransactionRow } from '@/lib/validation/transaction'
import { toCsv } from './serialize'

export interface ExportInput {
  accounts: AccountRow[]
  categories: CategoryRow[]
  /**
   * Categorization rules + saved import templates (P5-02, GDPR completeness).
   * Optional so the older `buildJsonBundle` consumer and the round-trip importer
   * (which only reads accounts/categories/transactions) are unaffected.
   */
  importTemplates?: ImportTemplateRow[]
  rules?: CategorizationRuleRow[]
  transactions: TransactionRow[]
}

export const TRANSACTIONS_HEADER = [
  'date',
  'description',
  'amount',
  'currency',
  'category_id',
  'account_id',
  'note',
  'tags',
  'is_transfer',
  'is_recurring',
] as const

/** Signed integer cents → a major-unit number (exact for typical values). */
const toMajor = (cents: number): number => cents / 100

/** The transactions ledger as an import-round-trippable CSV string. */
export function transactionsCsv(txns: TransactionRow[]): string {
  const rows = txns.map((t) => [
    t.occurred_at,
    t.description,
    toMajor(t.amount_cents),
    t.currency,
    t.category_id,
    t.account_id,
    t.note,
    t.tags.join(';'),
    String(t.is_transfer),
    String(t.is_recurring),
  ])
  return toCsv([...TRANSACTIONS_HEADER], rows)
}

/**
 * The full dataset as a JSON-serializable bundle with a meta header. When the
 * export was filtered, `meta.filters` records the active query params so a
 * partial export is self-describing; unfiltered bundles carry no `filters` key.
 */
export function buildJsonBundle(
  input: ExportInput,
  meta: {
    exportedAt: string
    version: string
    filters?: Record<string, string>
  }
): object {
  const { filters, ...rest } = meta
  return {
    meta: {
      ...rest,
      ...(filters && Object.keys(filters).length > 0 ? { filters } : {}),
      counts: {
        accounts: input.accounts.length,
        categories: input.categories.length,
        transactions: input.transactions.length,
      },
    },
    accounts: input.accounts,
    categories: input.categories,
    transactions: input.transactions,
  }
}

// ---------------------------------------------------------------------------
// Domain-aware backup (Spec A, 2026-07-15)
//
// One versioned envelope for every JSON download — per-domain and "Everything"
// differ only in which domain keys are present. `schemaVersion` is the forward
// contract the round-trip import engine (Spec B) validates against. Only
// user-owned rows travel; investment holdings/quotes/history and other derived
// or shared data are recomputed/re-fetched on import, never carried in the file.

/**
 * The integer contract version stamped into every backup envelope. Bumped to
 * 2 when `property_loans` was folded into the generic `debts` table — the
 * loan row shape changed incompatibly (field renames + new required columns),
 * so backups exported under version 1 are no longer parseable.
 */
export const BACKUP_SCHEMA_VERSION = 2

/**
 * Minimal asset reference carried alongside investment transactions so import
 * can re-resolve holdings by symbol without shipping provider cache columns.
 */
export interface AssetRef {
  coingecko_id: string | null
  currency: string
  exchange: string | null
  id: string
  isin: string | null
  name: string
  ticker: string | null
  type: string
}

export interface InvestmentsExportInput {
  accounts: InvestmentAccountRow[]
  assets: AssetRef[]
  portfolios: PortfolioRow[]
  transactions: InvestmentTransactionRow[]
}

export interface RealEstateExportInput {
  expenses: PropertyExpenseRow[]
  income: RentalIncomeRow[]
  loans: DebtRow[]
  properties: PropertyRow[]
  valuations: PropertyValuationRow[]
}

export interface BackupParts {
  investments?: InvestmentsExportInput
  realEstate?: RealEstateExportInput
  transactions?: ExportInput
}

/**
 * Assemble the backup envelope from whichever domains are supplied. Absent
 * domains produce no key and no `counts` entry, so a partial export stays
 * self-describing. `exportedAt` is injected (the core never reads the clock).
 */
export function buildBackupBundle(
  parts: BackupParts,
  meta: { exportedAt: string; filters?: Record<string, string> }
): object {
  const domains: string[] = []
  const counts: Record<string, Record<string, number>> = {}
  const body: Record<string, unknown> = {}

  if (parts.transactions) {
    const t = parts.transactions
    domains.push('transactions')
    counts.transactions = {
      accounts: t.accounts.length,
      categories: t.categories.length,
      transactions: t.transactions.length,
      ...(t.rules ? { rules: t.rules.length } : {}),
      ...(t.importTemplates
        ? { importTemplates: t.importTemplates.length }
        : {}),
    }
    body.transactions = t
  }
  if (parts.investments) {
    const i = parts.investments
    domains.push('investments')
    counts.investments = {
      portfolios: i.portfolios.length,
      accounts: i.accounts.length,
      assets: i.assets.length,
      transactions: i.transactions.length,
    }
    body.investments = i
  }
  if (parts.realEstate) {
    const r = parts.realEstate
    domains.push('realEstate')
    counts.realEstate = {
      properties: r.properties.length,
      loans: r.loans.length,
      valuations: r.valuations.length,
      income: r.income.length,
      expenses: r.expenses.length,
    }
    body.realEstate = r
  }

  const { filters } = meta
  return {
    meta: {
      app: 'finova',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: meta.exportedAt,
      domains,
      ...(filters && Object.keys(filters).length > 0 ? { filters } : {}),
      counts,
    },
    ...body,
  }
}

export const INVESTMENT_TRANSACTIONS_HEADER = [
  'date',
  'type',
  'asset',
  'ticker',
  'quantity',
  'price',
  'currency',
  'fees',
  'portfolio_id',
  'account_id',
  'asset_id',
  'notes',
] as const

/** Investment transactions as a flat, human-readable CSV (export-only). */
export function investmentTransactionsCsv(
  txns: InvestmentTransactionRow[],
  assets: AssetRef[]
): string {
  const byId = new Map(assets.map((a) => [a.id, a]))
  const rows = txns.map((t) => {
    const asset = byId.get(t.asset_id)
    return [
      t.traded_at,
      t.type,
      asset?.name ?? '',
      asset?.ticker ?? '',
      t.quantity,
      toMajor(t.price_cents),
      t.currency,
      toMajor(t.fees_cents),
      t.portfolio_id,
      t.account_id,
      t.asset_id,
      t.notes,
    ]
  })
  return toCsv([...INVESTMENT_TRANSACTIONS_HEADER], rows)
}

export const PROPERTIES_HEADER = [
  'name',
  'type',
  'address',
  'city',
  'country',
  'currency',
  'purchase_date',
  'purchase_price',
  'transfer_tax',
  'notary',
  'registry',
  'agency_fee',
  'renovation_cost',
  'other_purchase_costs',
  'current_value',
  'last_valued_at',
  'is_rented',
  'rental_start_date',
  'rental_end_date',
  'is_sold',
  'sold_date',
  'sold_price',
  'sold_fees',
  'notes',
  'id',
] as const

/** Properties as a flat CSV (parent rows only; children ride in JSON). */
export function propertiesCsv(properties: PropertyRow[]): string {
  const rows = properties.map((p) => [
    p.name,
    p.type,
    p.address,
    p.city,
    p.country,
    p.currency,
    p.purchase_date,
    toMajor(p.purchase_price_cents),
    toMajor(p.transfer_tax_cents),
    toMajor(p.notary_cents),
    toMajor(p.registry_cents),
    toMajor(p.agency_fee_cents),
    toMajor(p.renovation_cost_cents),
    toMajor(p.other_purchase_costs_cents),
    toMajor(p.current_value_cents),
    p.last_valued_at,
    String(p.is_rented),
    p.rental_start_date,
    p.rental_end_date,
    String(p.is_sold),
    p.sold_date,
    p.sold_price_cents == null ? null : toMajor(p.sold_price_cents),
    p.sold_fees_cents == null ? null : toMajor(p.sold_fees_cents),
    p.notes,
    p.id,
  ])
  return toCsv([...PROPERTIES_HEADER], rows)
}
