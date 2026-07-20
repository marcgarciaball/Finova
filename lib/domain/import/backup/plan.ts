/**
 * Pure planner for round-trip real-estate import (Spec B). Classifies every
 * incoming row as new or duplicate against the user's existing fingerprints,
 * resolves each child to its parent by the parent's fingerprint (id-independent,
 * so it survives the import's UUID remap), and returns per-table counts plus an
 * ordered plan the commit action executes. No I/O — the caller supplies the
 * existing-fingerprint snapshot and performs the inserts.
 */
import type { RealEstateExportInput } from '@/lib/domain/export/bundle'
import type {
  PropertyExpenseRow,
  PropertyLoanRow,
  PropertyRow,
  PropertyValuationRow,
  RentalIncomeRow,
} from '@/lib/validation/real-estate'
import {
  expenseFingerprint,
  incomeFingerprint,
  loanFingerprint,
  propertyFingerprint,
  valuationFingerprint,
} from './fingerprint'

export type RealEstateTable =
  | 'properties'
  | 'loans'
  | 'valuations'
  | 'income'
  | 'expenses'

export interface TableCounts {
  duplicate: number
  error: number
  new: number
}

export interface PlannedProperty {
  /** DB id of the matching existing property (duplicates only). */
  existingId?: string
  fp: string
  row: PropertyRow
  status: 'new' | 'duplicate'
}

export interface PlannedChild<T> {
  fp: string
  parentFp: string
  row: T
}

export interface RealEstateImportPlan {
  counts: Record<RealEstateTable, TableCounts>
  expenses: PlannedChild<PropertyExpenseRow>[]
  income: PlannedChild<RentalIncomeRow>[]
  /** New children only, keyed to their parent by fingerprint. */
  loans: PlannedChild<PropertyLoanRow>[]
  /** All incoming properties (new inserts + duplicates carrying existingId). */
  properties: PlannedProperty[]
  valuations: PlannedChild<PropertyValuationRow>[]
}

/** The user's current fingerprints, read from the DB by the caller. */
export interface ExistingRealEstate {
  /** every existing child fingerprint (across all child tables). */
  childFps: Set<string>
  /** property fingerprint → its DB id. */
  propertyIdByFp: Map<string, string>
}

const zeroCounts = (): TableCounts => ({ new: 0, duplicate: 0, error: 0 })

export function planRealEstateImport(
  parsed: RealEstateExportInput,
  existing: ExistingRealEstate
): RealEstateImportPlan {
  const counts: Record<RealEstateTable, TableCounts> = {
    properties: zeroCounts(),
    loans: zeroCounts(),
    valuations: zeroCounts(),
    income: zeroCounts(),
    expenses: zeroCounts(),
  }

  // --- Properties: classify + index incoming by export id -----------------
  const properties: PlannedProperty[] = []
  const fpByExportId = new Map<string, string>()
  const seenPropertyFp = new Set<string>()

  for (const row of parsed.properties) {
    const fp = propertyFingerprint(row)
    fpByExportId.set(row.id, fp)
    if (seenPropertyFp.has(fp)) {
      continue // duplicate within the same file — keep the first only
    }
    seenPropertyFp.add(fp)

    const existingId = existing.propertyIdByFp.get(fp)
    if (existingId) {
      counts.properties.duplicate++
      properties.push({ fp, status: 'duplicate', existingId, row })
    } else {
      counts.properties.new++
      properties.push({ fp, status: 'new', row })
    }
  }

  const seenChildFp = new Set<string>()

  // Generic child classifier: resolve parent by export id, fingerprint, count.
  const classifyChild = <T>(
    table: RealEstateTable,
    row: T & { property_id: string },
    fpOf: (parentFp: string, r: T) => string,
    out: PlannedChild<T>[]
  ) => {
    const parentFp = fpByExportId.get(row.property_id)
    if (!parentFp) {
      counts[table].error++ // orphaned child: parent not in the file
      return
    }
    const fp = fpOf(parentFp, row)
    if (seenChildFp.has(fp) || existing.childFps.has(fp)) {
      counts[table].duplicate++
      return
    }
    seenChildFp.add(fp)
    counts[table].new++
    out.push({ parentFp, fp, row })
  }

  const loans: PlannedChild<PropertyLoanRow>[] = []
  for (const row of parsed.loans) {
    classifyChild('loans', row, loanFingerprint, loans)
  }
  const valuations: PlannedChild<PropertyValuationRow>[] = []
  for (const row of parsed.valuations) {
    classifyChild('valuations', row, valuationFingerprint, valuations)
  }
  const income: PlannedChild<RentalIncomeRow>[] = []
  for (const row of parsed.income) {
    classifyChild('income', row, incomeFingerprint, income)
  }
  const expenses: PlannedChild<PropertyExpenseRow>[] = []
  for (const row of parsed.expenses) {
    classifyChild('expenses', row, expenseFingerprint, expenses)
  }

  return { counts, properties, loans, valuations, income, expenses }
}
