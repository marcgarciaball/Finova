/**
 * Content fingerprints for round-trip real-estate import (Spec B). Each is an
 * `fnv1a` hash (reused from the transactions importer) over a canonical,
 * id-independent key: two rows with the same business content collide, which is
 * the duplicate signal. Child keys embed the **parent's** fingerprint rather
 * than its id, so they survive the id remap that import performs on every row.
 */
import { fnv1a } from '@/lib/domain/import/fingerprint'
import type {
  PropertyExpenseRow,
  PropertyLoanRow,
  PropertyValuationRow,
  RentalIncomeRow,
} from '@/lib/validation/real-estate'

export function propertyFingerprint(p: {
  name: string
  type: string
  purchase_date: string
  purchase_price_cents: number
  currency: string
}): string {
  return fnv1a(
    [p.name, p.type, p.purchase_date, p.purchase_price_cents, p.currency].join(
      '|'
    )
  )
}

export function loanFingerprint(
  parentFp: string,
  l: Pick<
    PropertyLoanRow,
    'lender_name' | 'start_date' | 'original_amount_cents'
  >
): string {
  return fnv1a(
    [parentFp, l.lender_name, l.start_date, l.original_amount_cents].join('|')
  )
}

export function valuationFingerprint(
  parentFp: string,
  v: Pick<PropertyValuationRow, 'valuation_date' | 'value_cents'>
): string {
  return fnv1a([parentFp, v.valuation_date, v.value_cents].join('|'))
}

export function incomeFingerprint(
  parentFp: string,
  i: Pick<RentalIncomeRow, 'period_start' | 'period_end' | 'amount_cents'>
): string {
  return fnv1a(
    [parentFp, i.period_start, i.period_end, i.amount_cents].join('|')
  )
}

export function expenseFingerprint(
  parentFp: string,
  e: Pick<
    PropertyExpenseRow,
    'expense_date' | 'category' | 'amount_cents' | 'description'
  >
): string {
  return fnv1a(
    [parentFp, e.expense_date, e.category, e.amount_cents, e.description].join(
      '|'
    )
  )
}
