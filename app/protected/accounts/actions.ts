'use server'

import { reconciliationDelta } from '@finova/domain/accounts/reconcile'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import {
  createAccountSchema,
  parseInterestRateToBps,
  parseOpeningBalanceToCents,
  updateAccountSchema,
} from '@/lib/validation/account'
import { parseAmountToCents } from '@/lib/validation/transaction'

/**
 * CRUD Server Actions for accounts (P1-02).
 *
 * Every action: starts with `requireUser()` (app-layer guard), uses the
 * RLS-enforced Supabase server client, and derives the owner from the verified
 * JWT `sub` — never from the form. Ownership on update/delete is enforced by
 * RLS (`using`/`with check`); a foreign/missing id simply affects 0 rows.
 */

const ACCOUNTS_PATH = '/protected/accounts'

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

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

const VALIDATION_FAILED = 'validationFailed'
const UNEXPECTED = 'unexpected'

export async function createAccount(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const claims = await requireUser()

  const parsed = createAccountSchema.safeParse({
    name: formData.get('name'),
    type: formData.get('type'),
    currency: formData.get('currency'),
    openingBalance: formData.get('openingBalance') ?? undefined,
    interestRate: formData.get('interestRate') ?? undefined,
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: VALIDATION_FAILED,
      fieldErrors: toFieldErrors(parsed.error),
    }
  }

  try {
    const openingBalance = parseOpeningBalanceToCents(
      parsed.data.openingBalance,
      parsed.data.currency
    )
    const supabase = await createClient()
    const { error } = await supabase.from('accounts').insert({
      user_id: claims.sub,
      name: parsed.data.name,
      type: parsed.data.type,
      currency: parsed.data.currency,
      opening_balance: openingBalance,
      interest_rate_bps: parseInterestRateToBps(parsed.data.interestRate),
    })
    if (error) {
      return { ok: false, error: UNEXPECTED }
    }
  } catch {
    return { ok: false, error: UNEXPECTED }
  }

  revalidatePath(ACCOUNTS_PATH)
  return { ok: true }
}

export async function updateAccount(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  await requireUser()

  const parsed = updateAccountSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    type: formData.get('type'),
    currency: formData.get('currency'),
    openingBalance: formData.get('openingBalance') ?? undefined,
    interestRate: formData.get('interestRate') ?? undefined,
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: VALIDATION_FAILED,
      fieldErrors: toFieldErrors(parsed.error),
    }
  }

  try {
    const openingBalance = parseOpeningBalanceToCents(
      parsed.data.openingBalance,
      parsed.data.currency
    )
    const supabase = await createClient()
    // RLS scopes the update to the caller's rows; a foreign id matches nothing.
    const { error } = await supabase
      .from('accounts')
      .update({
        name: parsed.data.name,
        type: parsed.data.type,
        currency: parsed.data.currency,
        opening_balance: openingBalance,
        interest_rate_bps: parseInterestRateToBps(parsed.data.interestRate),
      })
      .eq('id', parsed.data.id)
    if (error) {
      return { ok: false, error: UNEXPECTED }
    }
  } catch {
    return { ok: false, error: UNEXPECTED }
  }

  revalidatePath(ACCOUNTS_PATH)
  return { ok: true }
}

/** Archive / unarchive (soft delete) — the everyday removal action. */
export async function setArchived(
  id: string,
  archived: boolean
): Promise<ActionResult> {
  await requireUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: UNEXPECTED }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('accounts')
    .update({ archived })
    .eq('id', id)
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }

  revalidatePath(ACCOUNTS_PATH)
  return { ok: true }
}

const reconcileSchema = z.object({
  accountId: z.string().uuid(),
  targetAmount: z.string().trim().min(1),
  description: z.string().trim().min(1).max(200),
})

/**
 * Manual balance reconciliation (roadmap 1.1). Records a single balancing
 * **adjustment transaction** for the gap between the account's derived balance
 * and the real balance the user enters — history is preserved, never edited.
 * Owner from the JWT; the account + its transactions are read RLS-scoped, so
 * the current balance can't be computed from another user's data.
 */
export async function reconcileAccount(
  accountId: string,
  targetAmount: string,
  description: string
): Promise<ActionResult> {
  const claims = await requireUser()

  const parsed = reconcileSchema.safeParse({
    accountId,
    targetAmount,
    description,
  })
  if (!parsed.success) {
    return { ok: false, error: VALIDATION_FAILED }
  }

  try {
    const supabase = await createClient()
    const { data: account } = await supabase
      .from('accounts')
      .select('id, currency, opening_balance')
      .eq('id', parsed.data.accountId)
      .maybeSingle()
    if (!account) {
      return { ok: false, error: UNEXPECTED }
    }
    const currency = String(account.currency)

    // Current balance = opening + Σ same-currency transactions (mirrors the
    // P4-01 `accountBalances` core, which never sums across currencies).
    const { data: txns, error: txnsError } = await supabase
      .from('transactions')
      .select('amount_cents, currency')
      .eq('account_id', parsed.data.accountId)
    if (txnsError) {
      return { ok: false, error: UNEXPECTED }
    }
    const current = (txns ?? []).reduce(
      (sum, r) =>
        String(r.currency) === currency ? sum + Number(r.amount_cents) : sum,
      Number(account.opening_balance)
    )

    const target = parseAmountToCents(parsed.data.targetAmount, currency)
    const delta = reconciliationDelta(current, target)
    // Already balanced — nothing to record (and a zero row would violate the
    // amount-nonzero check).
    if (delta === 0) {
      return { ok: true }
    }

    const { error } = await supabase.from('transactions').insert({
      user_id: claims.sub,
      account_id: parsed.data.accountId,
      category_id: null,
      amount_cents: delta,
      currency,
      occurred_at: new Date().toISOString(),
      description: parsed.data.description,
      note: null,
      tags: [],
      is_recurring: false,
    })
    if (error) {
      return { ok: false, error: UNEXPECTED }
    }
  } catch {
    return { ok: false, error: UNEXPECTED }
  }

  revalidatePath(ACCOUNTS_PATH)
  revalidatePath('/protected')
  return { ok: true }
}

/**
 * Hard delete. The `transactions.account_id` FK is `ON DELETE restrict`
 * (P1-04), so Postgres blocks deletion of an account that still has
 * transactions and returns SQLSTATE `23503` — surfaced here as the friendly
 * `hasTransactions` error rather than a generic failure.
 */
export async function deleteAccount(id: string): Promise<ActionResult> {
  await requireUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: UNEXPECTED }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  if (error) {
    if (error.code === '23503') {
      return { ok: false, error: 'hasTransactions' }
    }
    return { ok: false, error: UNEXPECTED }
  }

  revalidatePath(ACCOUNTS_PATH)
  return { ok: true }
}
