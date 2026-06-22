/**
 * Account domain vocabulary (P1-02).
 *
 * The set of account types and their asset/liability classification. The
 * classification is derived in code (this lookup), never stored — see the
 * accounts design spec.
 */
export const ACCOUNT_TYPES = [
  'checking',
  'savings',
  'cash',
  'credit_card',
  'investment',
] as const

export type AccountType = (typeof ACCOUNT_TYPES)[number]

/**
 * Liabilities carry balances whose sign means the opposite of an asset's.
 * Used for future balance derivations (P1-04) and for labelling.
 */
export const LIABILITY_TYPES = new Set<AccountType>(['credit_card'])

export const isLiability = (t: AccountType): boolean => LIABILITY_TYPES.has(t)
