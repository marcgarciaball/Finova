import { propertiesCsv } from '@/lib/domain/export/bundle'
import { getRealEstateExportData } from '../data'

/**
 * Properties as a flat CSV (Spec A). RLS-scoped via `getRealEstateExportData`.
 * Parent rows only — a property's loans/valuations/income/expenses ride in the
 * JSON backup, which is also the round-trip import channel.
 */
export async function GET(): Promise<Response> {
  const { properties } = await getRealEstateExportData()
  const csv = propertiesCsv(properties)
  const date = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="finova-real-estate-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
