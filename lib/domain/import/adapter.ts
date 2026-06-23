/**
 * Import adapter contract + registry (P2-02).
 *
 * An adapter recognizes one bank's export format and normalizes its already-
 * parsed rows into {@link RawTxn} records. The registry picks the first adapter
 * whose `detect` matches (registration order = priority); when none match it
 * returns `null`, signalling the caller to fall back to the generic
 * column-mapping flow (P2-03).
 *
 * Pure: detection and normalization only — no I/O, no DB. The stateful edges
 * (storage, commit) live in Server Actions. See the `add-import-adapter` skill
 * for how to add a fixture-driven bank adapter.
 */

import type { ParsedCsv } from './csv'

/**
 * A normalized transaction produced by an adapter, before it is tied to an
 * account or persisted. The account is chosen per import batch, not by the
 * adapter, so it is intentionally absent here.
 */
export interface RawTxn {
  /** Signed integer cents — the sign is the income/expense source of truth. */
  amountCents: number
  /** ISO-4217; when omitted the import flow falls back to the account currency. */
  currency?: string
  description: string
  note?: string
  /** ISO `YYYY-MM-DD`. */
  occurredAt: string
}

/** A bank/format-specific importer. Pure: recognizes a file and normalizes it. */
export interface ImportAdapter {
  /** Recognize this file from its parsed structure (header signature, marker). */
  detect(parsed: ParsedCsv): boolean
  readonly id: string
  /** Normalize recognized rows into raw transactions. */
  parse(parsed: ParsedCsv): RawTxn[]
}

/**
 * Pick the first adapter that recognizes the file, or `null` to fall back to
 * the generic column-mapping flow. List order is priority order.
 */
export function selectAdapter(
  adapters: readonly ImportAdapter[],
  parsed: ParsedCsv
): ImportAdapter | null {
  return adapters.find((a) => a.detect(parsed)) ?? null
}

export interface AdapterRegistry {
  /** A copy of the registered adapters, in registration (priority) order. */
  list(): ImportAdapter[]
  /** Add an adapter; throws on a duplicate id. */
  register(adapter: ImportAdapter): void
  /** First adapter recognizing `parsed`, else `null`. */
  select(parsed: ParsedCsv): ImportAdapter | null
}

/** Create a registry seeded with `initial` adapters (priority = order). */
export function createAdapterRegistry(
  initial: readonly ImportAdapter[] = []
): AdapterRegistry {
  const adapters: ImportAdapter[] = [...initial]
  return {
    register(adapter) {
      if (adapters.some((a) => a.id === adapter.id)) {
        throw new Error(`duplicate adapter id: ${adapter.id}`)
      }
      adapters.push(adapter)
    },
    list: () => adapters.slice(),
    select: (parsed) => selectAdapter(adapters, parsed),
  }
}
