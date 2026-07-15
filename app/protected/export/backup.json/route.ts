import { type BackupParts, buildBackupBundle } from '@/lib/domain/export/bundle'
import { parseExportDomains } from '@/lib/domain/export/domains'
import {
  filtersToSearchParams,
  hasActiveFilters,
  parseFilters,
} from '@/lib/domain/transactions/filters'
import {
  getExportData,
  getInvestmentsExportData,
  getRealEstateExportData,
} from '../data'

/**
 * Domain-parameterized JSON backup (Spec A). One route serves the "Everything"
 * bundle and every per-domain JSON, selected by `?domains=` (default all).
 * Each domain read is RLS-scoped; transaction filters (`from`/`to`/`account`/
 * `category`) narrow the transactions domain only and are recorded in
 * `meta.filters` so a partial export stays self-describing. The versioned
 * envelope is the forward contract the round-trip importer validates.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const domains = parseExportDomains(url.searchParams.get('domains'))
  const filters = parseFilters(Object.fromEntries(url.searchParams))
  const filteredTxns =
    hasActiveFilters(filters) && domains.includes('transactions')

  const parts: BackupParts = {}
  if (domains.includes('transactions')) {
    parts.transactions = await getExportData(filters)
  }
  if (domains.includes('investments')) {
    parts.investments = await getInvestmentsExportData()
  }
  if (domains.includes('realEstate')) {
    parts.realEstate = await getRealEstateExportData()
  }

  const exportedAt = new Date().toISOString()
  const bundle = buildBackupBundle(parts, {
    exportedAt,
    ...(filteredTxns
      ? { filters: Object.fromEntries(filtersToSearchParams(filters)) }
      : {}),
  })

  const label =
    domains.length === 1
      ? domains[0] === 'realEstate'
        ? 'real-estate'
        : domains[0]
      : 'backup'
  const suffix = filteredTxns ? '-filtered' : ''

  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="finova-${label}-${exportedAt.slice(0, 10)}${suffix}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
