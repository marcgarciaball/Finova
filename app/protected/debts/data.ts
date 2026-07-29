import 'server-only'
import {
  aggregateDebts,
  type CurrencyDebtTotals,
} from '@finova/domain/debts/metrics'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import { type DebtRow, debtRowSchema } from '@/lib/validation/debts'

/**
 * Read layer for the Debts screen. RLS-scoped user client throughout; every
 * row passes through `debtRowSchema`. Totals are computed here from raw rows
 * via the pure domain module — nothing financial is derived in the UI.
 */

export interface DebtsOverview {
  debts: DebtRow[]
  totals: CurrencyDebtTotals[]
}

/** Every debt for the user, plus currency/type totals. */
export async function getDebtsOverview(): Promise<DebtsOverview> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .order('start_date', { ascending: false })
  if (error) {
    throw new Error(error.message)
  }
  const debts = debtRowSchema.array().parse(data ?? [])
  const totals = aggregateDebts(
    debts.map((d) => ({
      currency: d.currency,
      outstandingCents: d.outstanding_cents,
      status: d.status,
      type: d.type,
    }))
  )
  return { debts, totals }
}

/** One debt by id, or null when not visible under RLS. */
export async function getDebtDetail(id: string): Promise<DebtRow | null> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    throw new Error(error.message)
  }
  if (!data) {
    return null
  }
  return debtRowSchema.parse(data)
}

/**
 * Currency/type totals only, for the main dashboard. Cheap: a single
 * narrow select, no joins.
 */
export async function getDebtsSummary(): Promise<CurrencyDebtTotals[]> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('debts')
    .select('currency, outstanding_cents, status, type')
  if (error) {
    throw new Error(error.message)
  }
  const snapshots = (data ?? []).map((d) => ({
    currency: String(d.currency),
    outstandingCents: Number(d.outstanding_cents),
    status: d.status as 'active' | 'paid_off' | 'defaulted',
    type: String(d.type),
  }))
  return aggregateDebts(snapshots)
}
