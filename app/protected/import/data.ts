import 'server-only'
import { transactionFingerprint } from '@finova/domain/import/fingerprint'
import type { Rule } from '@finova/domain/rules/types'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import {
  categorizationRuleRowSchema,
  toDomainRule,
} from '@/lib/validation/categorization-rule'
import {
  type ImportTemplateRow,
  importTemplateRowSchema,
} from '@/lib/validation/import-template'

/**
 * Read helpers for import templates (P2-03). All reads go through the
 * RLS-enforced Supabase server client, so a user only ever sees their own
 * templates. Lookups are by the file's header signature (the template key).
 */

/** The caller's saved template for this layout, or null when none exists. */
export async function findTemplateBySignature(
  signature: string
): Promise<ImportTemplateRow | null> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('import_templates')
    .select('*')
    .eq('header_signature', signature)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  return data ? importTemplateRowSchema.parse(data) : null
}

/** All of the caller's saved templates, newest first. */
export async function listTemplates(): Promise<ImportTemplateRow[]> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('import_templates')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }
  return importTemplateRowSchema.array().parse(data)
}

/**
 * The caller's enabled categorization rules (P3-03), ordered by precedence:
 * `priority` ascending, `created_at` ascending on ties — the order
 * `selectCategory` relies on. RLS-scoped to the owner; rows are parsed at the
 * boundary and mapped to the domain `Rule`.
 */
export async function listEnabledRulesForCategorization(): Promise<Rule[]> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categorization_rules')
    .select('*')
    .eq('enabled', true)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }
  return categorizationRuleRowSchema.array().parse(data).map(toDomainRule)
}

/** Add one UTC day to a `YYYY-MM-DD` date, returning `YYYY-MM-DD`. */
function nextUtcDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Deterministic fingerprints of the account's existing transactions within
 * [minDate, maxDate] (inclusive, ISO dates). Computed on the fly because manual
 * transactions carry no stored fingerprint (P2-08 writes it). Used by the
 * review classifier to flag rows that already exist. RLS-scoped to the caller.
 *
 * The upper bound is the EXCLUSIVE next-UTC-day midnight so a row with a
 * sub-second time on `maxDate` (e.g. `…T23:59:59.5Z`) is still included — its
 * UTC fingerprint date is `maxDate`, so it must be a duplicate candidate.
 */
export async function existingFingerprintsForAccount(
  accountId: string,
  minDate: string,
  maxDate: string
): Promise<Set<string>> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('transactions')
    .select('account_id, occurred_at, amount_cents, description')
    .eq('account_id', accountId)
    .gte('occurred_at', `${minDate}T00:00:00Z`)
    .lt('occurred_at', `${nextUtcDay(maxDate)}T00:00:00Z`)

  if (error) {
    throw new Error(error.message)
  }

  const out = new Set<string>()
  for (const row of data ?? []) {
    out.add(
      transactionFingerprint({
        accountId: row.account_id as string,
        amountCents: Number(row.amount_cents),
        description: row.description as string,
        occurredAt: new Date(row.occurred_at as string)
          .toISOString()
          .slice(0, 10),
      })
    )
  }
  return out
}
