import { buildJsonBundle } from '@/lib/domain/export/bundle'
import { getExportData } from '../data'

const BUNDLE_VERSION = '1'

/**
 * Full-dataset JSON export (P4-05). RLS-scoped via `getExportData`: accounts +
 * categories + transactions in one machine-readable bundle with a meta header.
 */
export async function GET(): Promise<Response> {
  const data = await getExportData()
  const exportedAt = new Date().toISOString()
  const bundle = buildJsonBundle(data, {
    exportedAt,
    version: BUNDLE_VERSION,
  })

  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="finova-export-${exportedAt.slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
