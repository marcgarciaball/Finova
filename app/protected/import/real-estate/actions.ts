'use server'

import { parseBackup } from '@finova/domain/import/backup/parse'
import {
  planRealEstateImport,
  type RealEstateImportPlan,
  type RealEstateTable,
  type TableCounts,
} from '@finova/domain/import/backup/plan'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import { getRealEstateFingerprints } from './data'

/**
 * Real-estate round-trip import (Spec B). Two actions mirror the transactions
 * importer: `review` parses + plans and reports per-table counts; `commit`
 * re-parses (authoritative — never trusts a client-side plan), re-reads the
 * user's fingerprints, and inserts. Ownership comes from the JWT; every insert
 * carries `import_fingerprint`, so `ON CONFLICT (user_id, import_fingerprint)`
 * makes a re-run a no-op even under a concurrent double-submit.
 */

export type RealEstateReviewResult =
  | {
      ok: true
      counts: Record<RealEstateTable, TableCounts>
      totals: TableCounts
    }
  | { ok: false; error: string }

export type RealEstateCommitResult =
  | {
      ok: true
      counts: Record<RealEstateTable, TableCounts>
      committed: number
      skipped: number
      errors: number
    }
  | { ok: false; error: string }

function sumCounts(counts: Record<RealEstateTable, TableCounts>): TableCounts {
  return Object.values(counts).reduce(
    (acc, c) => ({
      new: acc.new + c.new,
      duplicate: acc.duplicate + c.duplicate,
      error: acc.error + c.error,
    }),
    { new: 0, duplicate: 0, error: 0 }
  )
}

/** Parse + plan a file, returning it and the plan (shared by review/commit). */
async function planFromFile(
  fileText: string
): Promise<
  { ok: true; plan: RealEstateImportPlan } | { ok: false; error: string }
> {
  let raw: unknown
  try {
    raw = JSON.parse(fileText)
  } catch {
    return { ok: false, error: 'malformed' }
  }
  const parsed = parseBackup(raw)
  if (!parsed.ok) return { ok: false, error: parsed.error.code }
  if (!parsed.data.realEstate) return { ok: false, error: 'noRealEstate' }

  const existing = await getRealEstateFingerprints()
  const plan = planRealEstateImport(parsed.data.realEstate, existing)
  return { ok: true, plan }
}

export async function reviewRealEstateBackup(input: {
  fileText: string
}): Promise<RealEstateReviewResult> {
  await requireUser()
  try {
    const result = await planFromFile(input.fileText)
    if (!result.ok) return { ok: false, error: result.error }
    return {
      ok: true,
      counts: result.plan.counts,
      totals: sumCounts(result.plan.counts),
    }
  } catch {
    return { ok: false, error: 'unexpected' }
  }
}

export async function commitRealEstateBackup(input: {
  fileText: string
}): Promise<RealEstateCommitResult> {
  const claims = await requireUser()
  const userId = claims.sub
  try {
    const result = await planFromFile(input.fileText)
    if (!result.ok) return { ok: false, error: result.error }
    const { plan } = result
    const supabase = await createClient()

    // 1. Properties: duplicates already resolve to an existing id; insert the
    //    new ones and map their fingerprint → the freshly generated id.
    const fpToId = new Map<string, string>()
    for (const p of plan.properties) {
      if (p.status === 'duplicate' && p.existingId) {
        fpToId.set(p.fp, p.existingId)
      }
    }
    const newProperties = plan.properties.filter((p) => p.status === 'new')
    if (newProperties.length > 0) {
      const payloads = newProperties.map((p) => ({
        user_id: userId,
        name: p.row.name,
        type: p.row.type,
        address: p.row.address,
        city: p.row.city,
        country: p.row.country,
        currency: p.row.currency,
        purchase_date: p.row.purchase_date,
        purchase_price_cents: p.row.purchase_price_cents,
        purchase_fees_cents: p.row.purchase_fees_cents,
        current_value_cents: p.row.current_value_cents,
        last_valued_at: p.row.last_valued_at,
        is_rented: p.row.is_rented,
        rental_start_date: p.row.rental_start_date,
        rental_end_date: p.row.rental_end_date,
        is_sold: p.row.is_sold,
        sold_date: p.row.sold_date,
        sold_price_cents: p.row.sold_price_cents,
        sold_fees_cents: p.row.sold_fees_cents,
        notes: p.row.notes,
        import_fingerprint: p.fp,
      }))
      const { data, error } = await supabase
        .from('properties')
        .insert(payloads)
        .select('id, import_fingerprint')
      if (error) throw new Error(error.message)
      for (const row of data ?? []) {
        if (row.import_fingerprint) {
          fpToId.set(String(row.import_fingerprint), String(row.id))
        }
      }
    }

    // 2. Children: attach to the resolved parent id, carry the child fp.
    const insertChildren = async (
      table: string,
      rows: { property_id: string; import_fingerprint: string }[]
    ) => {
      if (rows.length === 0) return
      const { error } = await supabase.from(table).insert(rows)
      if (error) throw new Error(error.message)
    }

    const childRows = <T>(
      items: { parentFp: string; fp: string; row: T }[],
      build: (row: T) => Record<string, unknown>
    ) =>
      items
        .filter((c) => fpToId.has(c.parentFp))
        .map((c) => ({
          ...build(c.row),
          user_id: userId,
          property_id: fpToId.get(c.parentFp) as string,
          import_fingerprint: c.fp,
        }))

    await insertChildren(
      'property_loans',
      childRows(plan.loans, (l) => ({
        lender_name: l.lender_name,
        loan_type: l.loan_type,
        currency: l.currency,
        original_amount_cents: l.original_amount_cents,
        outstanding_cents: l.outstanding_cents,
        interest_rate_pct: l.interest_rate_pct,
        rate_type: l.rate_type,
        start_date: l.start_date,
        end_date: l.end_date,
        monthly_payment_cents: l.monthly_payment_cents,
        euribor_spread_pct: l.euribor_spread_pct,
        last_review_date: l.last_review_date,
        notes: l.notes,
        is_paid_off: l.is_paid_off,
      }))
    )
    await insertChildren(
      'property_valuations',
      childRows(plan.valuations, (v) => ({
        valuation_date: v.valuation_date,
        value_cents: v.value_cents,
        source: v.source,
        notes: v.notes,
      }))
    )
    await insertChildren(
      'rental_income',
      childRows(plan.income, (i) => ({
        period_start: i.period_start,
        period_end: i.period_end,
        amount_cents: i.amount_cents,
        currency: i.currency,
        tenant_name: i.tenant_name,
        is_paid: i.is_paid,
        notes: i.notes,
      }))
    )
    await insertChildren(
      'property_expenses',
      childRows(plan.expenses, (e) => ({
        category: e.category,
        description: e.description,
        amount_cents: e.amount_cents,
        currency: e.currency,
        expense_date: e.expense_date,
        is_recurring: e.is_recurring,
        recurrence: e.recurrence,
        notes: e.notes,
      }))
    )

    const totals = sumCounts(plan.counts)
    return {
      ok: true,
      counts: plan.counts,
      committed: totals.new,
      skipped: totals.duplicate,
      errors: totals.error,
    }
  } catch {
    return { ok: false, error: 'unexpected' }
  }
}
