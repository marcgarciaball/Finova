/** Enumerations shared by the debts schema, validation, and UI. */

export const DEBT_TYPES = [
  'mortgage',
  'car_loan',
  'personal_loan',
  'credit_card',
  'other',
] as const
export type DebtType = (typeof DEBT_TYPES)[number]

export const DEBT_RATE_TYPES = ['fixed', 'variable', 'mixed'] as const
export type DebtRateType = (typeof DEBT_RATE_TYPES)[number]

export const DEBT_STATUSES = ['active', 'paid_off', 'defaulted'] as const
export type DebtStatus = (typeof DEBT_STATUSES)[number]
