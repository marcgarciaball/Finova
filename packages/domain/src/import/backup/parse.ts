/**
 * Backup envelope parsing (Spec B). Validates a Finova export file before any
 * import work: the app marker and schema version must match, then each present
 * domain is zod-parsed through the same row schemas the export was built from.
 * Export ids/user_ids ride along but are treated as transient keys only — the
 * importer generates fresh UUIDs and derives ownership from the JWT, never from
 * the file.
 *
 * Pure and I/O-free. Spec B parses the Real Estate domain; Transactions and
 * Investments hook in at Specs C/D.
 */
import { z } from 'zod'
import { accountRowSchema } from '@/lib/validation/account'
import { categoryRowSchema } from '@/lib/validation/category'
import {
  investmentAccountRowSchema,
  investmentTransactionRowSchema,
  portfolioRowSchema,
} from '@/lib/validation/investments'
import {
  propertyExpenseRowSchema,
  propertyLoanRowSchema,
  propertyRowSchema,
  propertyValuationRowSchema,
  rentalIncomeRowSchema,
} from '@/lib/validation/real-estate'
import { transactionRowSchema } from '@/lib/validation/transaction'
import type {
  ExportInput,
  InvestmentsExportInput,
  RealEstateExportInput,
} from '../../export/bundle'
import { BACKUP_SCHEMA_VERSION } from '../../export/bundle'

export interface ParsedBackup {
  investments?: InvestmentsExportInput
  meta: { schemaVersion: number; exportedAt?: string; domains: string[] }
  realEstate?: RealEstateExportInput
  transactions?: ExportInput
}

export type BackupParseError =
  | { code: 'malformed'; message: string }
  | { code: 'notFinova'; message: string }
  | { code: 'unsupportedVersion'; message: string }

export type BackupParseResult =
  | { ok: true; data: ParsedBackup }
  | { ok: false; error: BackupParseError }

const metaSchema = z.object({
  app: z.string().optional(),
  schemaVersion: z.number(),
  exportedAt: z.string().optional(),
  domains: z.array(z.string()).optional(),
})

const realEstateSchema = z.object({
  properties: propertyRowSchema.array(),
  loans: propertyLoanRowSchema.array(),
  valuations: propertyValuationRowSchema.array(),
  income: rentalIncomeRowSchema.array(),
  expenses: propertyExpenseRowSchema.array(),
})

// Assets ride as a minimal reference (the export drops provider cache columns),
// so they get their own lightweight schema rather than the full `assetRowSchema`.
const assetRefSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
  ticker: z.string().nullable(),
  isin: z.string().nullable(),
  coingecko_id: z.string().nullable(),
  exchange: z.string().nullable(),
  name: z.string(),
  currency: z.string(),
})

const investmentsSchema = z.object({
  portfolios: portfolioRowSchema.array(),
  accounts: investmentAccountRowSchema.array(),
  assets: assetRefSchema.array(),
  transactions: investmentTransactionRowSchema.array(),
})

const transactionsSchema = z.object({
  accounts: accountRowSchema.array(),
  categories: categoryRowSchema.array(),
  transactions: transactionRowSchema.array(),
})

/** Parse + validate a Finova backup file (already `JSON.parse`d to `unknown`). */
export function parseBackup(raw: unknown): BackupParseResult {
  if (typeof raw !== 'object' || raw === null) {
    return {
      ok: false,
      error: { code: 'malformed', message: 'notAnObject' },
    }
  }
  const root = raw as Record<string, unknown>

  const metaParsed = metaSchema.safeParse(root.meta)
  if (!metaParsed.success) {
    return { ok: false, error: { code: 'notFinova', message: 'missingMeta' } }
  }
  const meta = metaParsed.data
  if (meta.app !== undefined && meta.app !== 'finova') {
    return { ok: false, error: { code: 'notFinova', message: 'wrongApp' } }
  }
  if (meta.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      error: {
        code: 'unsupportedVersion',
        message: String(meta.schemaVersion),
      },
    }
  }

  const parsed: ParsedBackup = {
    meta: {
      schemaVersion: meta.schemaVersion,
      exportedAt: meta.exportedAt,
      domains: meta.domains ?? [],
    },
  }

  if (root.realEstate !== undefined) {
    const re = realEstateSchema.safeParse(root.realEstate)
    if (!re.success) {
      return {
        ok: false,
        error: { code: 'malformed', message: 'realEstate' },
      }
    }
    parsed.realEstate = re.data
  }

  if (root.investments !== undefined) {
    const inv = investmentsSchema.safeParse(root.investments)
    if (!inv.success) {
      return {
        ok: false,
        error: { code: 'malformed', message: 'investments' },
      }
    }
    parsed.investments = inv.data
  }

  if (root.transactions !== undefined) {
    const tx = transactionsSchema.safeParse(root.transactions)
    if (!tx.success) {
      return {
        ok: false,
        error: { code: 'malformed', message: 'transactions' },
      }
    }
    parsed.transactions = tx.data
  }

  return { ok: true, data: parsed }
}
