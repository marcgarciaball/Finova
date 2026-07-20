'use server'

import { selectCategory } from '@finova/domain/rules/match'
import {
  composeSignedAmount,
  parseTagsInput,
} from '@finova/domain/transactions/form'
import { buildTransferLegs } from '@finova/domain/transactions/transfer'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { listEnabledRulesForCategorization } from '@/app/protected/import/data'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import {
  createTransactionSchema,
  createTransferSchema,
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

const SAME_ACCOUNT = 'sameAccount'

/**
 * Two-leg transfer wizard (roadmap 1.2): "move money A→B" as one action. Writes
 * both legs in a single insert sharing one `transfer_group_id` (the DB check
 * ties `is_transfer` to the group token, so a half-written pair can't exist as
 * anything but a transfer); the app layer rejects `from === to` since a
 * same-account "transfer" nets to zero and isn't meaningful. Ownership of both
 * accounts is verified before writing (FK checks bypass RLS).
 */
export async function createTransfer(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const claims = await requireUser()

  const parsed = createTransferSchema.safeParse({
    fromAccountId: formData.get('fromAccountId'),
    toAccountId: formData.get('toAccountId'),
    amount: formData.get('amount'),
    currency: formData.get('currency'),
    occurredAt: formData.get('occurredAt'),
    description: formData.get('description'),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: VALIDATION_FAILED,
      fieldErrors: toFieldErrors(parsed.error),
    }
  }
  if (parsed.data.fromAccountId === parsed.data.toAccountId) {
    return { ok: false, error: SAME_ACCOUNT }
  }

  try {
    const supabase = await createClient()
    const owned = await refsAreOwned(supabase, parsed.data.fromAccountId, null)
    const destOwned = await refsAreOwned(
      supabase,
      parsed.data.toAccountId,
      null
    )
    if (!(owned && destOwned)) {
      return { ok: false, error: FORBIDDEN_REF }
    }

    const amountCents = parseAmountToCents(
      parsed.data.amount,
      parsed.data.currency
    )
    const legs = buildTransferLegs({
      amountCents,
      currency: parsed.data.currency,
      description: parsed.data.description,
      fromAccountId: parsed.data.fromAccountId,
      groupId: crypto.randomUUID(),
      occurredAtIso: parsed.data.occurredAt.toISOString(),
      toAccountId: parsed.data.toAccountId,
    })

    const { error } = await supabase
      .from('transactions')
      .insert(legs.map((leg) => ({ ...leg, user_id: claims.sub })))
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

/**
 * Duplicate a transaction (roadmap 1.2): copy every descriptive field of the
 * caller's row into a fresh one dated **now** — the common "same purchase
 * again" flow. The copy is always a plain row: no `import_fingerprint` (it
 * must not collide with the import idempotency key) and never a transfer
 * (duplicating one leg would create an unpaired transfer; the UI hides the
 * control on transfer rows and the action refuses them).
 */
export async function duplicateTransaction(id: string): Promise<ActionResult> {
  const claims = await requireUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: UNEXPECTED }
  }

  const supabase = await createClient()
  // RLS scopes the read to the caller's rows — a foreign id yields nothing.
  const { data: source } = await supabase
    .from('transactions')
    .select(
      'account_id, category_id, amount_cents, currency, description, note, tags, is_transfer, is_recurring'
    )
    .eq('id', id)
    .maybeSingle()
  if (!source) {
    return { ok: false, error: UNEXPECTED }
  }
  if (source.is_transfer) {
    return { ok: false, error: 'isTransfer' }
  }

  const { error } = await supabase.from('transactions').insert({
    user_id: claims.sub,
    account_id: source.account_id,
    category_id: source.category_id,
    amount_cents: source.amount_cents,
    currency: source.currency,
    occurred_at: new Date().toISOString(),
    description: source.description,
    note: source.note,
    tags: source.tags,
    is_recurring: source.is_recurring,
  })
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }

  revalidatePath(TX_PATH)
  return { ok: true }
}

export type RecategorizeResult =
  | { ok: true; updated: number; scanned: number }
  | { ok: false; error: string }

/**
 * Apply the user's categorization rules to their **uncategorized** transactions
 * on demand (P3-03 on-demand path). Import only categorizes at commit time, so
 * this is how manually-added rows — and rows imported before any rule existed —
 * get categorized.
 *
 * Defaults are provisioned first (idempotent `seed_default_*` RPCs) so a user
 * created before the signup seed triggers existed still gets the built-in
 * categories + rules. Matching is the pure, deterministic `selectCategory`.
 */
export async function recategorizeUncategorized(): Promise<RecategorizeResult> {
  const claims = await requireUser()
  const userId = claims.sub
  const supabase = await createClient()

  // Best-effort: ensure the built-in categories + rules exist for this user
  // (no-op when already seeded — both functions are ON CONFLICT DO NOTHING).
  // Categories first: rule seeding resolves each rule's category by name_key.
  await supabase.rpc('seed_default_categories', { p_user_id: userId })
  await supabase.rpc('seed_default_rules', { p_user_id: userId })

  let rules: Awaited<ReturnType<typeof listEnabledRulesForCategorization>>
  try {
    rules = await listEnabledRulesForCategorization()
  } catch {
    return { ok: false, error: UNEXPECTED }
  }
  if (rules.length === 0) {
    return { ok: true, updated: 0, scanned: 0 }
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('id, description, amount_cents, account_id')
    .is('category_id', null)
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }
  const rows = data ?? []

  // Group ids by the category the rules pick, so each category is one UPDATE.
  const byCategory = new Map<string, string[]>()
  for (const row of rows) {
    const categoryId = selectCategory(rules, {
      description: String(row.description),
      amountCents: Number(row.amount_cents),
      accountId: String(row.account_id),
    })
    if (categoryId === null) continue
    const ids = byCategory.get(categoryId) ?? []
    ids.push(String(row.id))
    byCategory.set(categoryId, ids)
  }

  let updated = 0
  for (const [categoryId, ids] of byCategory) {
    const { error: updErr } = await supabase
      .from('transactions')
      .update({ category_id: categoryId })
      .in('id', ids)
    if (!updErr) {
      updated += ids.length
    }
  }

  revalidatePath(TX_PATH)
  return { ok: true, updated, scanned: rows.length }
}
