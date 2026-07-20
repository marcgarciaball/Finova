import 'server-only'
import { requireUser } from '@/lib/auth/require-user'
import type { MatchableTxn } from '@/lib/domain/rules/match'
import { createClient } from '@/lib/supabase/server'
import { type AccountRow, accountRowSchema } from '@/lib/validation/account'
import {
  type CategorizationRuleRow,
  categorizationRuleRowSchema,
} from '@/lib/validation/categorization-rule'
import { type CategoryRow, categoryRowSchema } from '@/lib/validation/category'

/**
 * Read helpers for rule management (P5-01). RLS-enforced throughout.
 */

/**
 * The user's rules in matcher precedence order (`priority asc, created_at asc`)
 * — the same order `selectCategory` relies on, so the list mirrors how rules
 * actually resolve at import time.
 */
export async function listRules(): Promise<CategorizationRuleRow[]> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categorization_rules')
    .select('*')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }
  return categorizationRuleRowSchema.array().parse(data)
}

/** Minimal transaction projection for the "test against your data" preview. */
export async function listTxnsForPreview(): Promise<MatchableTxn[]> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('transactions')
    .select('description, amount_cents, account_id')

  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []).map((r) => ({
    description: String(r.description ?? ''),
    amountCents: Number(r.amount_cents),
    accountId: String(r.account_id),
  }))
}

/** All categories, for the rule's target-category picker. */
export async function listCategories(): Promise<CategoryRow[]> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }
  return categoryRowSchema.array().parse(data)
}

/** Active accounts, for the account-clause picker. */
export async function listAccounts(): Promise<AccountRow[]> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('archived', false)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }
  return accountRowSchema.array().parse(data)
}
