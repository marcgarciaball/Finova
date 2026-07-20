import { transactionsCsv } from '@finova/domain/export/bundle'
import {
  hasActiveFilters,
  parseFilters,
} from '@finova/domain/transactions/filters'
import { getExportData } from '../data'

/**
 * CSV export of the transactions ledger (P4-05). RLS-scoped via `getExportData`.
 * Honors the shared filter query params (`from`/`to`/`account`/`category`);
 * malformed values are dropped by `parseFilters`, never rejected. The file
 * re-imports cleanly through the P2-03 pipeline (the gate invariant).
 */
export async function GET(request: Request): Promise<Response> {
  const filters = parseFilters(
    Object.fromEntries(new URL(request.url).searchParams)
  )
  const { transactions } = await getExportData(filters)
  const csv = transactionsCsv(transactions)
  const date = new Date().toISOString().slice(0, 10)
  const suffix = hasActiveFilters(filters) ? '-filtered' : ''

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="finova-transactions-${date}${suffix}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
