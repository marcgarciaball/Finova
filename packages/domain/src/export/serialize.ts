/**
 * CSV export serializer (P4-05). Pure — the inverse of the P2-03 `parseCsv`, so
 * an exported file round-trips back through the import pipeline.
 *
 * RFC-4180: a field is quoted iff it contains the delimiter, a double quote, CR,
 * or LF; embedded quotes are doubled; records are CRLF-joined.
 *
 * Formula-injection safety (P2-09) is applied per cell *by type*: string cells
 * pass through `sanitizeCell` (a leading `= + - @`/tab/CR gets a `'` prefix);
 * number cells are emitted verbatim. A JS number stringifies to `-?\d+(\.\d+)?`,
 * which spreadsheets treat as a number (not a formula), so it needs no guard —
 * and sanitizing it would prepend a `'` and break the "export round-trips
 * cleanly" invariant. `null`/`undefined` become an empty field.
 */
import { sanitizeCell } from '../import/csv'

export type CsvCell = string | number | null | undefined

const NEEDS_QUOTING = /[",\r\n]/

function quoteField(field: string): string {
  if (NEEDS_QUOTING.test(field)) {
    return `"${field.replaceAll('"', '""')}"`
  }
  return field
}

/** Render a single cell to its (quoted-as-needed) CSV field text. */
function renderCell(cell: CsvCell): string {
  if (cell == null) return ''
  // Numbers are trusted (not an injection vector) and must round-trip exactly;
  // only untrusted string cells get formula-sanitized.
  const text = typeof cell === 'number' ? String(cell) : sanitizeCell(cell)
  return quoteField(text)
}

const toRecord = (cells: readonly CsvCell[]): string =>
  cells.map(renderCell).join(',')

/**
 * Serialize `headers` + `rows` to an RFC-4180 CSV string (CRLF-joined). Headers
 * are app-controlled and written without sanitizing. Rows are not padded or
 * truncated to the header width — the caller owns row shape.
 */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers.map(quoteField).join(','), ...rows.map(toRecord)]
  return lines.join('\r\n')
}
