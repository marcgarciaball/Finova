/**
 * BBVA statement adapter (P2-04).
 *
 * BBVA's export carries a title/preamble line above the real header row, on the
 * same `;` delimiter. By the time `parseCsv` runs (header = row 0), the preamble
 * is the bogus header and the real header is buried in `rows`. This adapter is
 * hand-written to isolate that one quirk: `detect` scans the parsed headers
 * *and* rows for the BBVA header signature, and `parse` locates that line,
 * re-keys the rows that follow it, and delegates to the **same** `applyMapping`
 * + `ColumnMapping` every other adapter uses. Amounts are ES decimals
 * (negative = expense), dates `dd/mm/yyyy`; `Divisa` is a real ISO currency
 * code; `Disponible` (running balance) is ignored.
 */

import type { ImportAdapter, RawTxn } from '../adapter'
import { type ParsedCsv, rowsToRecords } from '../csv'
import {
  applyMapping,
  type ColumnMapping,
  normalizeHeader,
  type RowError,
} from '../mapping'

const SIGNATURE = ['Fecha', 'Concepto', 'Importe', 'Divisa', 'Disponible'].map(
  normalizeHeader
)

const mapping: ColumnMapping = {
  amount: {
    kind: 'single',
    column: 'Importe',
    negativeIs: 'expense',
    decimal: ',',
  },
  currency: { column: 'Divisa' },
  date: { column: 'Fecha', format: 'dmy' },
  description: { column: 'Concepto' },
}

/** True when `cells` is the BBVA header line (signature columns all present). */
function isHeaderRow(cells: string[]): boolean {
  const present = new Set(cells.map(normalizeHeader))
  return SIGNATURE.every((h) => present.has(h))
}

export const bbvaAdapter: ImportAdapter = {
  id: 'bbva',
  detect(parsed: ParsedCsv): boolean {
    return isHeaderRow(parsed.headers) || parsed.rows.some(isHeaderRow)
  },
  parse(parsed: ParsedCsv): { rows: RawTxn[]; errors: RowError[] } {
    // The header may be the parsed header (no preamble) or buried in the rows.
    const allRows = [parsed.headers, ...parsed.rows]
    const headerIndex = allRows.findIndex(isHeaderRow)
    const header = headerIndex === -1 ? undefined : allRows[headerIndex]
    if (!header) {
      return { rows: [], errors: [] }
    }
    const reKeyed: ParsedCsv = {
      headers: header.map((h) => h.trim()),
      rows: allRows.slice(headerIndex + 1),
    }
    return applyMapping(rowsToRecords(reKeyed), mapping)
  },
}
