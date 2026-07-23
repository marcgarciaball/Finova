/**
 * Pure pagination math for the transactions list (P5-06).
 *
 * "Load more" pagination fetches the list in fixed-size batches and appends
 * each new batch client-side (no page navigation, no scroll jump). Framework-
 * free and unit-testable; the data layer turns a batch's `[from, to]` range
 * into a PostgREST `.range()` and the UI turns {@link hasMore} into whether to
 * show the "load more" control.
 */

/** Rows fetched per "load more" batch. */
export const PAGE_SIZE = 50

/** Whether more rows exist beyond the number already loaded. */
export function hasMore(total: number, loaded: number): boolean {
  return total > loaded
}
