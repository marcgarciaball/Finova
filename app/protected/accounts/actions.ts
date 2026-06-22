'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import {
  createAccountSchema,
  parseOpeningBalanceToCents,
  updateAccountSchema,
} from '@/lib/validation/account'

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

/** Hard delete. Unrestricted today; gated on emptiness once transactions exist. */
export async function deleteAccount(id: string): Promise<ActionResult> {
  await requireUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: UNEXPECTED }
  }

  // TODO(P1-04): refuse when the account has transactions.
  const supabase = await createClient()
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }

  revalidatePath(ACCOUNTS_PATH)
  return { ok: true }
}
