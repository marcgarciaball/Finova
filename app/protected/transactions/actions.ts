'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/require-user'
import {
  composeSignedAmount,
  parseTagsInput,
} from '@/lib/domain/transactions/form'
import { createClient } from '@/lib/supabase/server'
import {
  createTransactionSchema,
  parseAmountToCents,
  updateTransactionSchema,
} from '@/lib/validation/transaction'

/**
 * CRUD + recategorize Server Actions for transactions (P1-05).
 *
 * Every action: starts with `requireUser()`, uses the RLS-enforced Supabase
 * server client, and derives the owner from the verified JWT `sub` — never from
 * the form. RLS scopes update/delete to the caller's rows (a foreign id matches
 * nothing). Because FK checks bypass RLS, the app layer additionally verifies
 * that the referenced `account_id` / `category_id` are owned by the caller
 * before writing (per the P1-04 design note).
 */

const TX_PATH = '/protected/transactions'

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

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
const FORBIDDEN_REF = 'forbiddenRef'

/** Read a FormData entry as a string, or null when absent/a File. */
function str(value: FormDataEntryValue | null): string | null {
  return typeof value === 'string' ? value : null
}

/** Confirm the caller owns the referenced account (and category, if any). */
async function refsAreOwned(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountId: string,
  categoryId: string | null
): Promise<boolean> {
  const { data: account } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', accountId)
    .maybeSingle()
  if (!account) {
    return false
  }
  if (categoryId) {
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('id', categoryId)
      .maybeSingle()
    if (!category) {
      return false
    }
  }
  return true
}

export async function createTransaction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const claims = await requireUser()

  const parsed = createTransactionSchema.safeParse({
    accountId: formData.get('accountId'),
    categoryId: formData.get('categoryId') ?? undefined,
    amount: composeSignedAmount(
      str(formData.get('direction')),
      str(formData.get('amount'))
    ),
    currency: formData.get('currency'),
    occurredAt: formData.get('occurredAt'),
    description: formData.get('description'),
    note: formData.get('note') ?? undefined,
    tags: parseTagsInput(str(formData.get('tags'))),
    isRecurring: formData.get('isRecurring') === 'on',
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: VALIDATION_FAILED,
      fieldErrors: toFieldErrors(parsed.error),
    }
  }

  try {
    const supabase = await createClient()
    if (
      !(await refsAreOwned(
        supabase,
        parsed.data.accountId,
        parsed.data.categoryId
      ))
    ) {
      return { ok: false, error: FORBIDDEN_REF }
    }
    const amountCents = parseAmountToCents(
      parsed.data.amount,
      parsed.data.currency
    )
    const { error } = await supabase.from('transactions').insert({
      user_id: claims.sub,
      account_id: parsed.data.accountId,
      category_id: parsed.data.categoryId,
      amount_cents: amountCents,
      currency: parsed.data.currency,
      occurred_at: parsed.data.occurredAt.toISOString(),
      description: parsed.data.description,
      note: parsed.data.note,
      tags: parsed.data.tags,
      is_recurring: parsed.data.isRecurring,
    })
    if (error) {
      return { ok: false, error: UNEXPECTED }
    }
  } catch {
    return { ok: false, error: UNEXPECTED }
  }

  revalidatePath(TX_PATH)
  return { ok: true }
}

export async function updateTransaction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  await requireUser()

  const parsed = updateTransactionSchema.safeParse({
    id: formData.get('id'),
    accountId: formData.get('accountId'),
    categoryId: formData.get('categoryId') ?? undefined,
    amount: composeSignedAmount(
      str(formData.get('direction')),
      str(formData.get('amount'))
    ),
    currency: formData.get('currency'),
    occurredAt: formData.get('occurredAt'),
    description: formData.get('description'),
    note: formData.get('note') ?? undefined,
    tags: parseTagsInput(str(formData.get('tags'))),
    isRecurring: formData.get('isRecurring') === 'on',
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: VALIDATION_FAILED,
      fieldErrors: toFieldErrors(parsed.error),
    }
  }

  try {
    const supabase = await createClient()
    if (
      !(await refsAreOwned(
        supabase,
        parsed.data.accountId,
        parsed.data.categoryId
      ))
    ) {
      return { ok: false, error: FORBIDDEN_REF }
    }
    const amountCents = parseAmountToCents(
      parsed.data.amount,
      parsed.data.currency
    )
    // RLS scopes the update to the caller's rows; a foreign id matches nothing.
    const { error } = await supabase
      .from('transactions')
      .update({
        account_id: parsed.data.accountId,
        category_id: parsed.data.categoryId,
        amount_cents: amountCents,
        currency: parsed.data.currency,
        occurred_at: parsed.data.occurredAt.toISOString(),
        description: parsed.data.description,
        note: parsed.data.note,
        tags: parsed.data.tags,
        is_recurring: parsed.data.isRecurring,
      })
      .eq('id', parsed.data.id)
    if (error) {
      return { ok: false, error: UNEXPECTED }
    }
  } catch {
    return { ok: false, error: UNEXPECTED }
  }

  revalidatePath(TX_PATH)
  return { ok: true }
}

/** Quick inline recategorize. `categoryId` null un-categorizes the row. */
export async function recategorizeTransaction(
  id: string,
  categoryId: string | null
): Promise<ActionResult> {
  await requireUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: UNEXPECTED }
  }
  if (categoryId !== null && !z.string().uuid().safeParse(categoryId).success) {
    return { ok: false, error: UNEXPECTED }
  }

  const supabase = await createClient()
  // Verify the target category is owned by the caller (FK checks bypass RLS).
  if (categoryId) {
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('id', categoryId)
      .maybeSingle()
    if (!category) {
      return { ok: false, error: FORBIDDEN_REF }
    }
  }
  const { error } = await supabase
    .from('transactions')
    .update({ category_id: categoryId })
    .eq('id', id)
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }

  revalidatePath(TX_PATH)
  return { ok: true }
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  await requireUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: UNEXPECTED }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }

  revalidatePath(TX_PATH)
  return { ok: true }
}
