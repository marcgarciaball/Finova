import { transactionsCsv } from '@/lib/domain/export/bundle'
import { getExportData } from '../data'

/**
 * CSV export of the transactions ledger (P4-05). RLS-scoped via `getExportData`.
 * The file re-imports cleanly through the P2-03 pipeline (the gate invariant).
 */
export async function GET(): Promise<Response> {
  const { transactions } = await getExportData()
  const csv = transactionsCsv(transactions)
  const date = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="finova-transactions-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
