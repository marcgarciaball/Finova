import { buildJsonBundle } from '@finova/domain/export/bundle'
import {
  filtersToSearchParams,
  hasActiveFilters,
  parseFilters,
} from '@finova/domain/transactions/filters'
import { getExportData } from '../data'

const BUNDLE_VERSION = '1'

/**
 * Full-dataset JSON export (P4-05). RLS-scoped via `getExportData`: accounts +
 * categories always complete; transactions narrowed by the shared filter query
 * params, with the active filters recorded in `meta.filters` so a partial
 * export is self-describing.
 */
export async function GET(request: Request): Promise<Response> {
  const filters = parseFilters(
    Object.fromEntries(new URL(request.url).searchParams)
  )
  const data = await getExportData(filters)
  const exportedAt = new Date().toISOString()
  const filtered = hasActiveFilters(filters)
  const bundle = buildJsonBundle(data, {
    exportedAt,
    version: BUNDLE_VERSION,
    ...(filtered
      ? { filters: Object.fromEntries(filtersToSearchParams(filters)) }
      : {}),
  })
  const suffix = filtered ? '-filtered' : ''

  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="finova-export-${exportedAt.slice(0, 10)}${suffix}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
