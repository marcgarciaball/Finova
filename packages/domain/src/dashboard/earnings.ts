/**
 * Which categories count toward the Earnings card's "how much do I earn"
 * total. Excluded categories still count as income everywhere else in the
 * app (transaction totals, spending/income charts) — this filter is
 * Earnings-card-only.
 */

/**
 * `name_key`s that are ambiguous incoming money (a Bizum/reimbursement, or
 * the generic incoming-transfer catch-all) rather than confirmed earnings.
 * A user who wants a specific transaction of these kinds to count recategorizes
 * it to a real income category (Salary, Gifts, Other income) — that already
 * makes it count, since this filter only looks at the assigned category.
 */
export const EARNINGS_EXCLUDED_CATEGORY_NAME_KEYS: ReadonlySet<string> =
  new Set(['bizum_income', 'transactions_income'])

/**
 * Whether a transaction's category counts as an "earning": it must have a
 * real category assigned (uncategorized is excluded — ambiguous until the
 * user picks one) and that category must not be one of the excluded
 * ambiguous-transfer buckets.
 */
export function isEarningCategory(
  categoryId: string | null,
  nameKey: string | null | undefined
): boolean {
  if (categoryId === null) {
    return false
  }
  return !EARNINGS_EXCLUDED_CATEGORY_NAME_KEYS.has(nameKey ?? '')
}
