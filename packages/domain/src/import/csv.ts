/**
 * CSV parsing + cell safety for the import engine (P2-03, P2-09).
 *
 * A small RFC-4180-style parser (quoted fields, escaped quotes, embedded
 * delimiters/newlines) plus delimiter auto-detection for the common European
 * variants (`,` `;` tab). Pure and synchronous — bank statements are small
 * enough to parse in memory, and keeping it pure makes it exhaustively testable.
 *
 * `sanitizeCell` neutralizes CSV/spreadsheet **formula injection** (P2-09): a
 * cell beginning with `= + - @` (or tab/CR) can execute when the file is later
 * opened in Excel/Sheets. We prefix such cells with a single quote so they are
 * always treated as text on round-trip/export.
 */

export type Delimiter = ',' | ';' | '\t'

const DELIMITERS: Delimiter[] = [',', ';', '\t']

/**
 * Guess the delimiter from the first non-empty line by counting candidates
 * outside of quotes. Falls back to comma when there's nothing to go on.
 */
export function detectDelimiter(sample: string): Delimiter {
  const firstLine = sample.split(/\r?\n/).find((l) => l.trim() !== '') ?? ''
  let best: Delimiter = ','
  let bestCount = -1
  for (const d of DELIMITERS) {
    const count = countOutsideQuotes(firstLine, d)
    if (count > bestCount) {
      bestCount = count
      best = d
    }
  }
  return best
}

function countOutsideQuotes(line: string, delimiter: string): number {
  let count = 0
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === delimiter && !inQuotes) {
      count++
    }
  }
  return count
}

export interface ParseCsvOptions {
  /** Override delimiter detection. */
  delimiter?: Delimiter
  /** Treat the first parsed row as a header (default true). */
  header?: boolean
}

export interface ParsedCsv {
  headers: string[]
  /** Data rows as raw string cells (header row excluded when `header` is true). */
  rows: string[][]
}

/**
 * Parse CSV text into headers + rows. Handles quoted fields containing the
 * delimiter, newlines, and `""` escaped quotes. A trailing newline does not
 * produce a spurious empty row.
 */
export function parseCsv(text: string, opts: ParseCsvOptions = {}): ParsedCsv {
  const delimiter = opts.delimiter ?? detectDelimiter(text)
  const useHeader = opts.header ?? true

  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false
  let sawAnyChar = false

  const pushField = () => {
    record.push(field)
    field = ''
  }
  const pushRecord = () => {
    pushField()
    records.push(record)
    record = []
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    sawAnyChar = true
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++ // consume the escaped quote
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      pushField()
    } else if (ch === '\n') {
      pushRecord()
    } else if (ch === '\r') {
      // swallow; the following \n (if any) triggers the record break
    } else {
      field += ch
    }
  }

  // Flush the final field/record unless the input ended exactly on a newline.
  if (
    field !== '' ||
    record.length > 0 ||
    (sawAnyChar && records.length === 0)
  ) {
    pushRecord()
  }

  if (records.length === 0) {
    return { headers: [], rows: [] }
  }

  if (useHeader) {
    const [headerRow, ...rest] = records
    return { headers: (headerRow ?? []).map((h) => h.trim()), rows: rest }
  }
  return { headers: [], rows: records }
}

const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\r'])

/**
 * Neutralize spreadsheet formula injection: prefix a leading `=`/`+`/`-`/`@`
 * (or tab/CR) with a `'` so the cell is inert text. Leaves ordinary values
 * untouched. Note: a value like "-50" becomes "'-50" — callers that need the
 * numeric value should parse the raw cell *before* sanitizing for display/export.
 */
export function sanitizeCell(value: string): string {
  if (value.length > 0 && FORMULA_TRIGGERS.has(value[0] as string)) {
    return `'${value}`
  }
  return value
}

/** Map each row to an object keyed by the (trimmed) headers. */
export function rowsToRecords(parsed: ParsedCsv): Record<string, string>[] {
  return parsed.rows.map((row) => {
    const record: Record<string, string> = {}
    parsed.headers.forEach((h, i) => {
      record[h] = row[i] ?? ''
    })
    return record
  })
}
