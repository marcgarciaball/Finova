/**
 * Pure pagination math for the transactions list (P5-06).
 *
 * Offset pagination keeps only one page of rows fetched + rendered so a
 * multi-year ledger (thousands of rows) stays fast. Framework-free and
 * unit-testable; the data layer turns a `pageRange` into a PostgREST `.range()`
 * and the page turns `parsePage` / `totalPages` into a UI control.
 */

/** Rows per page. */
export const PAGE_SIZE = 50

/**
 * Parse a raw `?page=` value into a 1-based page number. Anything missing,
 * non-numeric, non-integer, or < 1 collapses to page 1 (never throws, never
 * returns 0 or a fraction).
 */
export function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) {
    return 1
  }
  return n
}

/** Inclusive PostgREST `.range(from, to)` bounds for a 1-based page. */
export function pageRange(
  page: number,
  size: number = PAGE_SIZE
): { from: number; to: number } {
  const from = (page - 1) * size
  return { from, to: from + size - 1 }
}

/** Total number of pages for a row count (always ≥ 1, so page 1 always exists). */
export function totalPages(total: number, size: number = PAGE_SIZE): number {
  if (total <= 0) {
    return 1
  }
  return Math.ceil(total / size)
}
