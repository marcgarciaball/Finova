/** Enumerations shared by the real-estate schema, validation, and UI. */

export const PROPERTY_TYPES = [
  'primary_home',
  'investment',
  'vacation',
  'land',
  'commercial',
  'other',
] as const
export type PropertyType = (typeof PROPERTY_TYPES)[number]

export const LOAN_TYPES = [
  'mortgage',
  'equity_release',
  'personal_loan',
  'developer_loan',
  'other',
] as const
export type LoanType = (typeof LOAN_TYPES)[number]

export const RATE_TYPES = ['fixed', 'variable', 'mixed'] as const
export type RateType = (typeof RATE_TYPES)[number]

export const EXPENSE_CATEGORIES = [
  'mortgage_payment',
  'property_tax',
  'community_fee',
  'insurance',
  'maintenance',
  'management_fee',
  'utilities',
  'legal',
  'renovation',
  'vacancy',
  'other',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const RECURRENCES = ['monthly', 'quarterly', 'yearly'] as const
export type Recurrence = (typeof RECURRENCES)[number]

export const VALUATION_SOURCES = [
  'manual',
  'appraisal',
  'agent_estimate',
  'zillow',
  'idealista',
  'other',
] as const
export type ValuationSource = (typeof VALUATION_SOURCES)[number]
