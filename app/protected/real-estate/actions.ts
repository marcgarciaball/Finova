'use server'

import { fromDecimal } from '@finova/domain/money'
import { totalFromMonthlyRentCents } from '@finova/domain/real-estate/metrics'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import {
  createExpenseSchema,
  createLoanSchema,
  createPropertySchema,
  createRentalIncomeSchema,
  createValuationSchema,
  normalizeDecimal,
  propertyRowSchema,
  propertyValuationRowSchema,
  sellPropertySchema,
  updateLoanSchema,
  updatePropertySchema,
  updateRentalIncomeSchema,
} from '@/lib/validation/real-estate'

/**
 * Server actions for the Real Estate screen. `requireUser()` first
 * everywhere; rows are keyed by verified `claims.sub` and RLS enforces
 * ownership. Child rows (loans, income, expenses, valuations) always inherit
 * the parent property's currency — the UI never sends one.
 */

const REAL_ESTATE_PATH = '/protected/real-estate'

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

const UNEXPECTED = 'unexpected'

/** First message per field, for inline form errors. */
function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !(key in out)) {
      out[key] = issue.message
    }
  }
  return out
}

/** Decimal string in major units → integer cents in `currency`. */
function toCents(input: string, currency: string): number {
  return fromDecimal(normalizeDecimal(input), currency).amount
}

function revalidate() {
  revalidatePath(REAL_ESTATE_PATH)
  revalidatePath('/protected')
}

/** The parsed property row, verifying visibility under RLS. */
async function getOwnProperty(propertyId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .maybeSingle()
  if (error || !data) {
    return null
  }
  return propertyRowSchema.parse(data)
}

export async function createProperty(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const claims = await requireUser()
  const parsed = createPropertySchema.safeParse({
    address: formData.get('address') ?? undefined,
    city: formData.get('city') ?? undefined,
    country: formData.get('country') || undefined,
    currency: formData.get('currency'),
    currentValue: formData.get('currentValue'),
    isRented: formData.get('isRented') === 'on',
    name: formData.get('name'),
    notes: formData.get('notes') ?? undefined,
    ownershipPct: formData.get('ownershipPct') || undefined,
    purchaseDate: formData.get('purchaseDate'),
    purchaseFees: formData.get('purchaseFees') || undefined,
    purchasePrice: formData.get('purchasePrice'),
    rentalEndDate: formData.get('rentalEndDate') || undefined,
    rentalStartDate: formData.get('rentalStartDate') || undefined,
    type: formData.get('type'),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validationFailed',
      fieldErrors: toFieldErrors(parsed.error),
    }
  }
  const input = parsed.data

  try {
    const supabase = await createClient()
    const currentValueCents = toCents(input.currentValue, input.currency)
    const { data: created, error } = await supabase
      .from('properties')
      .insert({
        address: input.address ?? null,
        city: input.city ?? null,
        country: input.country,
        currency: input.currency,
        current_value_cents: currentValueCents,
        is_rented: input.isRented,
        last_valued_at: input.purchaseDate,
        name: input.name,
        notes: input.notes ?? null,
        ownership_pct: normalizeDecimal(input.ownershipPct),
        purchase_date: input.purchaseDate,
        purchase_fees_cents: toCents(input.purchaseFees, input.currency),
        purchase_price_cents: toCents(input.purchasePrice, input.currency),
        rental_end_date: input.rentalEndDate ?? null,
        rental_start_date: input.rentalStartDate ?? null,
        type: input.type,
        user_id: claims.sub,
      })
      .select('id')
      .single()
    if (error || !created) {
      return { ok: false, error: UNEXPECTED }
    }
    // Seed the valuation history so growth charts start at day one.
    await supabase.from('property_valuations').insert({
      property_id: created.id,
      source: 'manual',
      user_id: claims.sub,
      valuation_date: input.purchaseDate,
      value_cents: currentValueCents,
    })
  } catch {
    return { ok: false, error: UNEXPECTED }
  }

  revalidate()
  return { ok: true }
}

export async function updateProperty(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  await requireUser()
  const parsed = updatePropertySchema.safeParse({
    address: formData.get('address') ?? undefined,
    city: formData.get('city') ?? undefined,
    id: formData.get('id'),
    isRented: formData.get('isRented') === 'on',
    name: formData.get('name'),
    notes: formData.get('notes') ?? undefined,
    ownershipPct: formData.get('ownershipPct'),
    rentalEndDate: formData.get('rentalEndDate') || undefined,
    rentalStartDate: formData.get('rentalStartDate') || undefined,
    type: formData.get('type'),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validationFailed',
      fieldErrors: toFieldErrors(parsed.error),
    }
  }
  const input = parsed.data

  const supabase = await createClient()
  const { error } = await supabase
    .from('properties')
    .update({
      address: input.address ?? null,
      city: input.city ?? null,
      is_rented: input.isRented,
      name: input.name,
      notes: input.notes ?? null,
      ownership_pct: normalizeDecimal(input.ownershipPct),
      rental_end_date: input.rentalEndDate ?? null,
      rental_start_date: input.rentalStartDate ?? null,
      type: input.type,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }
  revalidate()
  return { ok: true }
}

export async function sellProperty(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  await requireUser()
  const parsed = sellPropertySchema.safeParse({
    id: formData.get('id'),
    soldDate: formData.get('soldDate'),
    soldFees: formData.get('soldFees') || undefined,
    soldPrice: formData.get('soldPrice'),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validationFailed',
      fieldErrors: toFieldErrors(parsed.error),
    }
  }
  const input = parsed.data

  const property = await getOwnProperty(input.id)
  if (!property) {
    return { ok: false, error: UNEXPECTED }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from('properties')
    .update({
      is_sold: true,
      sold_date: input.soldDate,
      sold_fees_cents: toCents(input.soldFees, property.currency),
      sold_price_cents: toCents(input.soldPrice, property.currency),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }
  revalidate()
  return { ok: true }
}

export async function deleteProperty(id: string): Promise<ActionResult> {
  await requireUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: UNEXPECTED }
  }
  const supabase = await createClient()
  const { error } = await supabase.from('properties').delete().eq('id', id)
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }
  revalidate()
  return { ok: true }
}

export async function createLoan(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const claims = await requireUser()
  const parsed = createLoanSchema.safeParse({
    endDate: formData.get('endDate') || undefined,
    euriborSpreadPct: formData.get('euriborSpreadPct') || undefined,
    interestRatePct: formData.get('interestRatePct'),
    lenderName: formData.get('lenderName'),
    loanType: formData.get('loanType'),
    monthlyPayment: formData.get('monthlyPayment'),
    notes: formData.get('notes') ?? undefined,
    originalAmount: formData.get('originalAmount'),
    outstanding: formData.get('outstanding'),
    propertyId: formData.get('propertyId'),
    rateType: formData.get('rateType'),
    startDate: formData.get('startDate'),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validationFailed',
      fieldErrors: toFieldErrors(parsed.error),
    }
  }
  const input = parsed.data

  const property = await getOwnProperty(input.propertyId)
  if (!property) {
    return { ok: false, error: UNEXPECTED }
  }
  const supabase = await createClient()
  const { error } = await supabase.from('property_loans').insert({
    currency: property.currency,
    end_date: input.endDate ?? null,
    euribor_spread_pct:
      input.euriborSpreadPct != null
        ? normalizeDecimal(input.euriborSpreadPct)
        : null,
    interest_rate_pct: normalizeDecimal(input.interestRatePct),
    lender_name: input.lenderName,
    loan_type: input.loanType,
    monthly_payment_cents: toCents(input.monthlyPayment, property.currency),
    notes: input.notes ?? null,
    original_amount_cents: toCents(input.originalAmount, property.currency),
    outstanding_cents: toCents(input.outstanding, property.currency),
    property_id: input.propertyId,
    rate_type: input.rateType,
    start_date: input.startDate,
    user_id: claims.sub,
  })
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }
  revalidate()
  return { ok: true }
}

export async function updateLoan(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  await requireUser()
  const parsed = updateLoanSchema.safeParse({
    id: formData.get('id'),
    interestRatePct: formData.get('interestRatePct'),
    isPaidOff: formData.get('isPaidOff') === 'on',
    monthlyPayment: formData.get('monthlyPayment'),
    outstanding: formData.get('outstanding'),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validationFailed',
      fieldErrors: toFieldErrors(parsed.error),
    }
  }
  const input = parsed.data

  const supabase = await createClient()
  const { data: loanRow } = await supabase
    .from('property_loans')
    .select('currency')
    .eq('id', input.id)
    .maybeSingle()
  if (!loanRow) {
    return { ok: false, error: UNEXPECTED }
  }
  const currency = String(loanRow.currency)
  const { error } = await supabase
    .from('property_loans')
    .update({
      interest_rate_pct: normalizeDecimal(input.interestRatePct),
      is_paid_off: input.isPaidOff,
      last_review_date: new Date().toISOString().slice(0, 10),
      monthly_payment_cents: toCents(input.monthlyPayment, currency),
      outstanding_cents: input.isPaidOff
        ? 0
        : toCents(input.outstanding, currency),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }
  revalidate()
  return { ok: true }
}

export async function deleteLoan(id: string): Promise<ActionResult> {
  return deleteChild('property_loans', id)
}

export async function createRentalIncome(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const claims = await requireUser()
  const parsed = createRentalIncomeSchema.safeParse({
    amount: formData.get('amount'),
    amountKind: formData.get('amountKind') || undefined,
    isPaid: formData.get('isPaid') !== 'off',
    notes: formData.get('notes') ?? undefined,
    periodEnd: formData.get('periodEnd'),
    periodStart: formData.get('periodStart'),
    propertyId: formData.get('propertyId'),
    tenantName: formData.get('tenantName') ?? undefined,
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validationFailed',
      fieldErrors: toFieldErrors(parsed.error),
    }
  }
  const input = parsed.data

  const property = await getOwnProperty(input.propertyId)
  if (!property) {
    return { ok: false, error: UNEXPECTED }
  }
  // A monthly amount is expanded to the period total here, calendar-aware;
  // the row always stores the total received.
  const enteredCents = toCents(input.amount, property.currency)
  const amountCents =
    input.amountKind === 'monthly'
      ? totalFromMonthlyRentCents(
          enteredCents,
          input.periodStart,
          input.periodEnd
        )
      : enteredCents
  const supabase = await createClient()
  const { error } = await supabase.from('rental_income').insert({
    amount_cents: amountCents,
    currency: property.currency,
    is_paid: input.isPaid,
    notes: input.notes ?? null,
    period_end: input.periodEnd,
    period_start: input.periodStart,
    property_id: input.propertyId,
    tenant_name: input.tenantName ?? null,
    user_id: claims.sub,
  })
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }
  revalidate()
  return { ok: true }
}

export async function updateRentalIncome(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  await requireUser()
  const parsed = updateRentalIncomeSchema.safeParse({
    amount: formData.get('amount'),
    amountKind: formData.get('amountKind') || undefined,
    id: formData.get('id'),
    isPaid: formData.get('isPaid') !== 'off',
    notes: formData.get('notes') ?? undefined,
    periodEnd: formData.get('periodEnd'),
    periodStart: formData.get('periodStart'),
    tenantName: formData.get('tenantName') ?? undefined,
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validationFailed',
      fieldErrors: toFieldErrors(parsed.error),
    }
  }
  const input = parsed.data

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('rental_income')
    .select('currency')
    .eq('id', input.id)
    .maybeSingle()
  if (!existing) {
    return { ok: false, error: UNEXPECTED }
  }
  const currency = String(existing.currency)
  // A monthly amount is expanded to the period total here, calendar-aware;
  // the row always stores the total received.
  const enteredCents = toCents(input.amount, currency)
  const amountCents =
    input.amountKind === 'monthly'
      ? totalFromMonthlyRentCents(
          enteredCents,
          input.periodStart,
          input.periodEnd
        )
      : enteredCents
  const { error } = await supabase
    .from('rental_income')
    .update({
      amount_cents: amountCents,
      is_paid: input.isPaid,
      notes: input.notes ?? null,
      period_end: input.periodEnd,
      period_start: input.periodStart,
      tenant_name: input.tenantName ?? null,
    })
    .eq('id', input.id)
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }
  revalidate()
  return { ok: true }
}

export async function deleteRentalIncome(id: string): Promise<ActionResult> {
  return deleteChild('rental_income', id)
}

export async function createExpense(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const claims = await requireUser()
  const parsed = createExpenseSchema.safeParse({
    amount: formData.get('amount'),
    category: formData.get('category'),
    description: formData.get('description'),
    expenseDate: formData.get('expenseDate'),
    isRecurring: formData.get('isRecurring') === 'on',
    notes: formData.get('notes') ?? undefined,
    propertyId: formData.get('propertyId'),
    recurrence: formData.get('recurrence') || undefined,
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validationFailed',
      fieldErrors: toFieldErrors(parsed.error),
    }
  }
  const input = parsed.data

  const property = await getOwnProperty(input.propertyId)
  if (!property) {
    return { ok: false, error: UNEXPECTED }
  }
  const supabase = await createClient()
  const { error } = await supabase.from('property_expenses').insert({
    amount_cents: toCents(input.amount, property.currency),
    category: input.category,
    currency: property.currency,
    description: input.description,
    expense_date: input.expenseDate,
    is_recurring: input.isRecurring,
    notes: input.notes ?? null,
    property_id: input.propertyId,
    recurrence: input.isRecurring ? (input.recurrence ?? null) : null,
    user_id: claims.sub,
  })
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }
  revalidate()
  return { ok: true }
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  return deleteChild('property_expenses', id)
}

/**
 * Record a valuation snapshot (idempotent per property+date) and mirror the
 * newest valuation into the property's current value.
 */
export async function createValuation(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const claims = await requireUser()
  const parsed = createValuationSchema.safeParse({
    notes: formData.get('notes') ?? undefined,
    propertyId: formData.get('propertyId'),
    source: formData.get('source') || undefined,
    value: formData.get('value'),
    valuationDate: formData.get('valuationDate'),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validationFailed',
      fieldErrors: toFieldErrors(parsed.error),
    }
  }
  const input = parsed.data

  const property = await getOwnProperty(input.propertyId)
  if (!property) {
    return { ok: false, error: UNEXPECTED }
  }
  const supabase = await createClient()
  const { error } = await supabase.from('property_valuations').upsert(
    {
      notes: input.notes ?? null,
      property_id: input.propertyId,
      source: input.source,
      user_id: claims.sub,
      valuation_date: input.valuationDate,
      value_cents: toCents(input.value, property.currency),
    },
    { onConflict: 'property_id,valuation_date' }
  )
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }
  const syncError = await syncCurrentValue(input.propertyId)
  if (syncError) {
    return { ok: false, error: UNEXPECTED }
  }
  revalidate()
  return { ok: true }
}

export async function deleteValuation(id: string): Promise<ActionResult> {
  await requireUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: UNEXPECTED }
  }
  const supabase = await createClient()
  const { data: target } = await supabase
    .from('property_valuations')
    .select('property_id')
    .eq('id', id)
    .maybeSingle()
  const { error } = await supabase
    .from('property_valuations')
    .delete()
    .eq('id', id)
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }
  if (target) {
    await syncCurrentValue(String(target.property_id))
  }
  revalidate()
  return { ok: true }
}

/** Point `current_value_cents`/`last_valued_at` at the latest valuation. */
async function syncCurrentValue(propertyId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('property_valuations')
    .select('*')
    .eq('property_id', propertyId)
    .order('valuation_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    return error.message
  }
  if (!data) {
    return null // no snapshots left; keep the property's stored value
  }
  const latest = propertyValuationRowSchema.parse(data)
  const { error: updateError } = await supabase
    .from('properties')
    .update({
      current_value_cents: latest.value_cents,
      last_valued_at: latest.valuation_date,
      updated_at: new Date().toISOString(),
    })
    .eq('id', propertyId)
  return updateError ? updateError.message : null
}

async function deleteChild(
  table: 'property_loans' | 'rental_income' | 'property_expenses',
  id: string
): Promise<ActionResult> {
  await requireUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: UNEXPECTED }
  }
  const supabase = await createClient()
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }
  revalidate()
  return { ok: true }
}
