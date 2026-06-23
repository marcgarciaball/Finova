/**
 * Pure form-input helpers for the transaction Server Actions (P1-05).
 *
 * Kept out of the `'use server'` action module (which may only export async
 * functions) so they can be unit-tested directly. They normalize raw FormData
 * values into the shapes the Zod schemas expect.
 */

/**
 * Compose a signed decimal amount string from an income/expense direction and a
 * positive magnitude. Any leading sign on the magnitude is stripped first, so a
 * user typing "-50" with the "expense" toggle still yields "-50" (not "50").
 * An empty/whitespace magnitude is returned as "" so the schema can reject it.
 */
export function composeSignedAmount(
  direction: string | null,
  magnitude: string | null
): string {
  const raw = typeof magnitude === 'string' ? magnitude.trim() : ''
  if (raw === '') {
    return ''
  }
  const bare = raw.replace(/^[+-]/, '')
  return direction === 'expense' ? `-${bare}` : bare
}

/** Parse the `tags` field: a comma-separated string → trimmed, non-empty array. */
export function parseTagsInput(value: string | null): string[] {
  if (typeof value !== 'string') {
    return []
  }
  return value
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}
