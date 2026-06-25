/**
 * Pure upload-parsing pipeline for the import flow (P2-03).
 *
 * Composes the byte-decode (`encoding`), delimiter detection + CSV parse
 * (`csv`), and header signature (`mapping`) cores into the single step the
 * upload Server Action needs, plus the file guards (extension, size cap, row
 * cap) that belong with parsing rather than I/O. No DB, no storage, no `File`
 * API — it takes raw bytes so it is exhaustively unit-testable; the action just
 * reads the uploaded `File` into a `Uint8Array` and calls this.
 *
 * On success it returns the headers, a capped sample of header-keyed records
 * (enough for the client-side mapping preview), the full row count, the
 * order-sensitive header signature (template lookup key), and the encoding it
 * actually used. Any guard failure is a typed error — never a throw.
 */

import { parseCsv, rowsToRecords } from './csv'
import { decodeBytes, type ImportEncoding } from './encoding'
import { headerSignature } from './mapping'

/** 5 MB — bank CSV exports are far smaller; this is a safety ceiling. */
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024
/** A statement with more rows than this is almost certainly not a statement. */
const DEFAULT_MAX_ROWS = 10_000
/** Rows shown in the mapping preview (no file is retained, so this is enough). */
const DEFAULT_SAMPLE_SIZE = 20

export type ParseUploadError =
  | 'notCsv'
  | 'emptyFile'
  | 'tooLarge'
  | 'noRows'
  | 'tooManyRows'

export interface ParseUploadData {
  encoding: ImportEncoding
  headers: string[]
  rowCount: number
  /** First {@link DEFAULT_SAMPLE_SIZE} data rows, header-keyed, for preview. */
  sampleRecords: Record<string, string>[]
  signature: string
}

export type ParseUploadOutcome =
  | { ok: true; data: ParseUploadData }
  | { ok: false; error: ParseUploadError }

export interface ParseUploadOptions {
  encoding?: ImportEncoding | 'auto'
  maxBytes?: number
  maxRows?: number
  sampleSize?: number
}

export function parseUploadBytes(
  filename: string,
  bytes: Uint8Array,
  opts: ParseUploadOptions = {}
): ParseUploadOutcome {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES
  const maxRows = opts.maxRows ?? DEFAULT_MAX_ROWS
  const sampleSize = opts.sampleSize ?? DEFAULT_SAMPLE_SIZE

  if (!/\.csv$/i.test(filename.trim())) {
    return { ok: false, error: 'notCsv' }
  }
  if (bytes.length === 0) {
    return { ok: false, error: 'emptyFile' }
  }
  if (bytes.length > maxBytes) {
    return { ok: false, error: 'tooLarge' }
  }

  const { text, encoding } = decodeBytes(bytes, { encoding: opts.encoding })
  const parsed = parseCsv(text)

  if (parsed.rows.length === 0) {
    return { ok: false, error: 'noRows' }
  }
  if (parsed.rows.length > maxRows) {
    return { ok: false, error: 'tooManyRows' }
  }

  const records = rowsToRecords(parsed)
  return {
    ok: true,
    data: {
      encoding,
      headers: parsed.headers,
      rowCount: records.length,
      sampleRecords: records.slice(0, sampleSize),
      signature: headerSignature(parsed.headers),
    },
  }
}
