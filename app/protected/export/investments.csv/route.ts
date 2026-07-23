import { investmentTransactionsCsv } from '@finova/domain/export/bundle'
import { getInvestmentsExportData } from '../data'

/**
 * Investment transactions as a flat CSV (Spec A). RLS-scoped via
 * `getInvestmentsExportData`. Human/spreadsheet convenience — the JSON backup
 * is the round-trip import channel.
 */
export async function GET(): Promise<Response> {
  const { transactions, assets } = await getInvestmentsExportData()
  const csv = investmentTransactionsCsv(transactions, assets)
  const date = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="finova-investments-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
