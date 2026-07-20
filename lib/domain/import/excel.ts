/**
 * Excel <-> tabular-data bridge for the import/export flows.
 *
 * The import engine speaks `ParsedCsv` (a header row + string-cell rows); banks
 * hand out both modern `.xlsx` and legacy binary `.xls` statements, and we will
 * export ledgers as `.xlsx` too. This module is the single place that crosses
 * the spreadsheet boundary in both directions so the rest of the pipeline never
 * touches a workbook:
 *
 *   - `parseSpreadsheetToParsed` reads the first worksheet into the same
 *     `{ headers, rows }` shape `parseCsv` produces — every cell stringified to
 *     a form the locale-aware date/amount parsers already understand (dates as
 *     ISO `YYYY-MM-DD`, numbers via their decimal text). Downstream mapping,
 *     review and commit are then format-agnostic. It routes by extension:
 *     `.xlsx` through ExcelJS (maintained), the legacy binary `.xls` through
 *     SheetJS (the only reader for the old BIFF/OLE2 format; pinned to the
 *     CVE-patched CDN build, not the frozen npm one).
 *   - `recordsToExcelBytes` is the inverse for export (P-future): a single sheet
 *     with a header row, every cell run through `sanitizeCell` so a `=`/`+`/`-`/`@`
 *     value can't execute when the file is reopened — the same formula-injection
 *     guard the CSV path applies.
 */

import ExcelJS from 'exceljs'
import * as XLSX from 'xlsx'
import type { ParsedCsv } from './csv'
import { sanitizeCell } from './csv'

/** True for the legacy binary `.xls` extension (routed through SheetJS). */
function isXlsName(filename: string): boolean {
  return /\.xls$/i.test(filename.trim())
}

/** Format a JS Date as ISO `YYYY-MM-DD` using UTC parts (Excel serial dates are
 *  zone-agnostic; both readers materialize them at UTC midnight). */
function dateToIso(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Stringify a primitive cell value (SheetJS path) the same way the ExcelJS path
 *  does: dates to ISO, numbers/booleans to text, blanks to the empty string. */
function primitiveToString(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (value instanceof Date) {
    return dateToIso(value)
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return String(value)
}

/** Count the non-empty cells in a row. */
function filledCount(row: string[]): number {
  return row.reduce((n, cell) => (cell !== '' ? n + 1 : n), 0)
}

/**
 * Turn a raw cell matrix into `ParsedCsv`, skipping any leading preamble.
 *
 * Bank `.xls`/`.xlsx` statements (Sabadell, among others) prepend title/account/
 * date-range rows before the real column header — each spanning only a column or
 * two. We take the header to be the first row that fills the most columns (the
 * actual table header labels every column, while preamble rows don't), drop
 * everything above it, and clip to the header width. A clean file whose header
 * is already row 1 is unaffected: that row is the widest and comes first.
 */
function matrixToParsed(matrix: string[][]): ParsedCsv {
  const rows = matrix.filter((r) => r.some((cell) => cell !== ''))
  if (rows.length === 0) {
    return { headers: [], rows: [] }
  }

  const counts = rows.map(filledCount)
  const maxFilled = Math.max(...counts)
  const headerIdx = counts.indexOf(maxFilled)

  const headers = (rows[headerIdx] ?? []).map((h) => h.trim())
  const dataRows = rows.slice(headerIdx + 1)

  // Drop trailing columns with no header so record keys stay meaningful.
  let width = headers.length
  while (width > 0 && headers[width - 1] === '') {
    width--
  }
  return {
    headers: headers.slice(0, width),
    rows: dataRows.map((r) => r.slice(0, width)),
  }
}

/**
 * Stringify one ExcelJS cell value into the plain-text form the CSV pipeline
 * would have carried. Resolves formula/shared-formula cells to their computed
 * result, flattens rich text and hyperlinks to their visible text, and renders
 * a cell error (`#N/A`, …) and blanks as the empty string.
 */
function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value instanceof Date) {
    return dateToIso(value)
  }
  if (typeof value === 'object') {
    if ('error' in value) {
      return ''
    }
    if ('result' in value) {
      // Formula / shared-formula cell: use the cached computed result.
      return cellToString((value as { result?: ExcelJS.CellValue }).result)
    }
    if ('richText' in value) {
      return value.richText.map((part) => part.text).join('')
    }
    if ('text' in value) {
      // Hyperlink cell: keep the visible label, drop the target.
      return String((value as { text: unknown }).text ?? '')
    }
  }
  return ''
}

/** ExcelJS accepts a Buffer/ArrayBuffer; hand it an ArrayBuffer view of exactly
 *  the uploaded bytes (independent of any larger backing buffer). */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
}

/**
 * Read spreadsheet bytes into the same `ParsedCsv` shape as a CSV upload,
 * routing by extension: `.xls` (legacy binary BIFF/OLE2) through SheetJS, every
 * other Excel file through ExcelJS. The first non-empty row becomes the
 * (trimmed) header, the rest become string rows; blank rows and trailing
 * all-empty columns are dropped so header/row widths match. Throws on a
 * corrupt/unreadable file (the caller maps that to a typed error).
 */
export async function parseSpreadsheetToParsed(
  filename: string,
  bytes: Uint8Array
): Promise<ParsedCsv> {
  return isXlsName(filename)
    ? parseXlsToParsed(bytes)
    : await parseXlsxToParsed(bytes)
}

/** Parse modern OOXML `.xlsx` bytes via ExcelJS. */
async function parseXlsxToParsed(bytes: Uint8Array): Promise<ParsedCsv> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(toArrayBuffer(bytes))

  const sheet = workbook.worksheets[0]
  if (!sheet) {
    return { headers: [], rows: [] }
  }

  const colCount = sheet.columnCount
  const matrix: string[][] = []
  // includeEmpty:false skips gaps, but a row can still be entirely blank in the
  // used range; we filter those out explicitly to mirror the CSV parser.
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = []
    let hasContent = false
    for (let c = 1; c <= colCount; c++) {
      const text = cellToString(row.getCell(c).value)
      if (text !== '') {
        hasContent = true
      }
      cells.push(text)
    }
    if (hasContent) {
      matrix.push(cells)
    }
  })

  return matrixToParsed(matrix)
}

/**
 * Parse legacy binary `.xls` bytes via SheetJS — the only reader for the old
 * BIFF/OLE2 format. `cellDates` materializes date cells as JS `Date`s (rendered
 * to ISO like the ExcelJS path); `blankrows:false` drops empty rows.
 */
export function parseXlsToParsed(bytes: Uint8Array): ParsedCsv {
  const workbook = XLSX.read(bytes, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined
  if (!sheet) {
    return { headers: [], rows: [] }
  }

  const matrix = XLSX.utils
    .sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      blankrows: false,
      defval: '',
    })
    .map((row) => row.map(primitiveToString))

  return matrixToParsed(matrix)
}

/** A cell accepted by the .xlsx writer — same contract as the CSV serializer. */
export type ExcelCell = string | number | null | undefined

/** Render a cell to text by type, mirroring the CSV export (`toCsv`): numbers
 *  are trusted and emitted verbatim so they round-trip exactly; only untrusted
 *  string cells are formula-sanitized; blanks become an empty string. */
function renderCell(cell: ExcelCell): string {
  if (cell == null) {
    return ''
  }
  return typeof cell === 'number' ? String(cell) : sanitizeCell(cell)
}

/**
 * Serialize a header row + rows into .xlsx bytes for export — the inverse of
 * {@link parseExcelToParsed}, mirroring `toCsv`. Headers are app-controlled and
 * written verbatim; string cells pass through {@link sanitizeCell} so a leading
 * `=`/`+`/`-`/`@` can't execute on reopen, while number cells are emitted
 * unchanged (a stringified number is never a formula, and sanitizing it would
 * break the round-trip).
 */
export async function recordsToExcelBytes(
  headers: string[],
  rows: ExcelCell[][],
  sheetName = 'Sheet1'
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName)
  sheet.addRow(headers)
  for (const row of rows) {
    sheet.addRow(row.map(renderCell))
  }
  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer)
}
