import type { z } from 'zod'

/**
 * Shared Server-Action result shape + helpers (P5-01).
 *
 * Mirrors the `ActionResult` the accounts/transactions actions already use; the
 * Settings actions (profile/categories/rules) share it rather than each
 * re-declaring the same type and the same `ZodError` → field-errors reducer.
 */
export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

export const VALIDATION_FAILED = 'validationFailed'
export const UNEXPECTED = 'unexpected'

/** First message per field, for inline form errors. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !(key in out)) {
      out[key] = issue.message
    }
  }
  return out
}
