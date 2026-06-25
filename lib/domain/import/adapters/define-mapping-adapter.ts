/**
 * Build an {@link ImportAdapter} from a fixed {@link ColumnMapping} (P2-04).
 *
 * Most bank adapters differ only in *which columns mean what* — exactly what a
 * `ColumnMapping` + `applyMapping` already express. This helper turns a static
 * mapping plus a header signature into an adapter, so banks like ING, Revolut,
 * and CaixaBank are pure declarations with no bespoke parsing code. Banks whose
 * files need structural work before mapping (e.g. a preamble above the header)
 * are written by hand instead.
 */

import type { ImportAdapter, RawTxn } from '../adapter'
import { type ParsedCsv, rowsToRecords } from '../csv'
import {
  applyMapping,
  type ColumnMapping,
  normalizeHeader,
  type RowError,
} from '../mapping'

export interface MappingAdapterSpec {
  /** Unique adapter id (registration key, priority by order). */
  id: string
  /** The fixed column mapping applied to every recognized row. */
  mapping: ColumnMapping
  /**
   * Headers that must all be present (normalized: accent/case/whitespace-
   * tolerant, order-independent) for `detect` to recognize the file. Extra
   * columns are allowed; a missing signature header rejects the file so it
   * falls through to the generic mapping flow.
   */
  signatureHeaders: string[]
}

/** Build a declarative, mapping-driven adapter (see module docs). */
export function defineMappingAdapter(spec: MappingAdapterSpec): ImportAdapter {
  const signature = spec.signatureHeaders.map(normalizeHeader)
  return {
    id: spec.id,
    detect(parsed: ParsedCsv): boolean {
      const present = new Set(parsed.headers.map(normalizeHeader))
      return signature.every((h) => present.has(h))
    },
    parse(parsed: ParsedCsv): { rows: RawTxn[]; errors: RowError[] } {
      return applyMapping(rowsToRecords(parsed), spec.mapping)
    },
  }
}
