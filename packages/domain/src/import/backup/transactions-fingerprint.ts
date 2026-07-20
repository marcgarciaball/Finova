/**
 * Content fingerprints for round-trip transactions import (Spec D). Accounts and
 * categories get id-independent `fnv1a` hashes like the other domains. The
 * transaction fingerprint deliberately reuses the CSV importer's
 * `transactionFingerprint` (keyed on the *resolved* account DB id + amount +
 * description + date) so a JSON restore and a CSV import of the same row collide
 * — one unified dedup across both channels, backed by the existing
 * `(user_id, import_fingerprint)` unique index on `transactions`.
 */
import { fnv1a } from '../fingerprint'

export function accountFingerprint(a: {
  name: string
  type: string
  currency: string
}): string {
  return fnv1a([a.name, a.type, a.currency].join('|'))
}

/**
 * Category fingerprint. `parentFp` is the parent category's fingerprint (empty
 * string for a top-level category), so the two-level tree stays id-independent.
 */
export function categoryFingerprint(
  kind: string,
  name: string,
  parentFp: string
): string {
  return fnv1a([kind, name, parentFp].join('|'))
}

export { transactionFingerprint } from '../fingerprint'
