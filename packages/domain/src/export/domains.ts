/**
 * Export domain vocabulary (Spec A). The single source of truth for which
 * domains a backup can carry, shared by the export UI (building download URLs)
 * and the `backup.json` route (parsing `?domains=`). `realEstate` is the
 * envelope key; the UI/URL surface may spell it `real-estate` for readability.
 */

export const EXPORT_DOMAINS = [
  'transactions',
  'investments',
  'realEstate',
] as const
export type ExportDomain = (typeof EXPORT_DOMAINS)[number]

/**
 * Parse a comma-separated `?domains=` value into a valid, ordered domain list.
 * Unknown tokens are dropped; an empty/absent/all-invalid value means "every
 * domain" (the Everything backup). Order follows `EXPORT_DOMAINS`, so foreign
 * keys always serialize parents-before-children-friendly and deterministically.
 */
export function parseExportDomains(raw: string | null): ExportDomain[] {
  if (!raw) return [...EXPORT_DOMAINS]
  const requested = raw.split(',').map((s) => s.trim())
  const valid = EXPORT_DOMAINS.filter((d) => requested.includes(d))
  return valid.length > 0 ? valid : [...EXPORT_DOMAINS]
}
