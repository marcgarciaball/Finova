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
import { toCsv } from '@/lib/domain/export/serialize'
import type { AccountRow } from '@/lib/validation/account'
import type { CategoryRow } from '@/lib/validation/category'
import type { TransactionRow } from '@/lib/validation/transaction'

export interface ExportInput {
  accounts: AccountRow[]
  categories: CategoryRow[]
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
