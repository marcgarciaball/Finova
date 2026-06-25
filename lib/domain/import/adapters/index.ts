/**
 * Bank adapter registry (P2-04).
 *
 * `createBankRegistry()` assembles every built-in bank adapter into an
 * {@link AdapterRegistry}; the caller uses `select(parsed)` to pick the first
 * adapter that recognizes a file, falling back to `null` (the generic
 * column-mapping flow, P2-03) when none match. Registration order is priority
 * order — ES banks first, then Revolut — but the signatures are distinct enough
 * that order only matters if two `detect`s ever both match.
 */

import { type AdapterRegistry, createAdapterRegistry } from '../adapter'
import { bbvaAdapter } from './bbva'
import { caixabankAdapter } from './caixabank'
import { ingAdapter } from './ing'
import { revolutAdapter } from './revolut'

export { bbvaAdapter, caixabankAdapter, ingAdapter, revolutAdapter }

/** A registry seeded with all built-in bank adapters (priority by order). */
export function createBankRegistry(): AdapterRegistry {
  return createAdapterRegistry([
    ingAdapter,
    bbvaAdapter,
    caixabankAdapter,
    revolutAdapter,
  ])
}
