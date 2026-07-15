import 'server-only'
import { requireUser } from '@/lib/auth/require-user'
import {
  expenseFingerprint,
  incomeFingerprint,
  loanFingerprint,
  propertyFingerprint,
  valuationFingerprint,
} from '@/lib/domain/import/backup/fingerprint'
import type { ExistingRealEstate } from '@/lib/domain/import/backup/plan'
import { createClient } from '@/lib/supabase/server'

/**
 * Snapshot of the user's current real-estate fingerprints (Spec B). Read via
 * the RLS server client, projected to just the columns each fingerprint needs.
 * Fingerprints are computed from row content the same way the planner does, so
 * a manually-created row (whose stored `import_fingerprint` is NULL) is still
 * recognised as a duplicate at review time. cents columns are coerced with
 * `Number` so they stringify identically to the zod-coerced incoming rows.
 */
export async function getRealEstateFingerprints(): Promise<ExistingRealEstate> {
  await requireUser()
  const supabase = await createClient()

  const [props, loans, vals, income, expenses] = await Promise.all([
    supabase
      .from('properties')
      .select('id, name, type, purchase_date, purchase_price_cents, currency'),
    supabase
      .from('property_loans')
      .select('property_id, lender_name, start_date, original_amount_cents'),
    supabase
      .from('property_valuations')
      .select('property_id, valuation_date, value_cents'),
    supabase
      .from('rental_income')
      .select('property_id, period_start, period_end, amount_cents'),
    supabase
      .from('property_expenses')
      .select('property_id, expense_date, category, amount_cents, description'),
  ])
  for (const res of [props, loans, vals, income, expenses]) {
    if (res.error) throw new Error(res.error.message)
  }

  const propertyIdByFp = new Map<string, string>()
  const fpById = new Map<string, string>()
  for (const p of props.data ?? []) {
    const fp = propertyFingerprint({
      name: String(p.name),
      type: String(p.type),
      purchase_date: String(p.purchase_date),
      purchase_price_cents: Number(p.purchase_price_cents),
      currency: String(p.currency),
    })
    propertyIdByFp.set(fp, String(p.id))
    fpById.set(String(p.id), fp)
  }

  const childFps = new Set<string>()
  for (const l of loans.data ?? []) {
    const parentFp = fpById.get(String(l.property_id))
    if (!parentFp) continue
    childFps.add(
      loanFingerprint(parentFp, {
        lender_name: String(l.lender_name),
        start_date: String(l.start_date),
        original_amount_cents: Number(l.original_amount_cents),
      })
    )
  }
  for (const v of vals.data ?? []) {
    const parentFp = fpById.get(String(v.property_id))
    if (!parentFp) continue
    childFps.add(
      valuationFingerprint(parentFp, {
        valuation_date: String(v.valuation_date),
        value_cents: Number(v.value_cents),
      })
    )
  }
  for (const i of income.data ?? []) {
    const parentFp = fpById.get(String(i.property_id))
    if (!parentFp) continue
    childFps.add(
      incomeFingerprint(parentFp, {
        period_start: String(i.period_start),
        period_end: String(i.period_end),
        amount_cents: Number(i.amount_cents),
      })
    )
  }
  for (const e of expenses.data ?? []) {
    const parentFp = fpById.get(String(e.property_id))
    if (!parentFp) continue
    childFps.add(
      expenseFingerprint(parentFp, {
        expense_date: String(e.expense_date),
        category: String(e.category) as never,
        amount_cents: Number(e.amount_cents),
        description: String(e.description),
      })
    )
  }

  return { propertyIdByFp, childFps }
}
