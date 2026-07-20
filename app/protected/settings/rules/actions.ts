'use server'

import { previewRuleMatches } from '@finova/domain/rules/preview'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import {
  conditionsSchema,
  createCategorizationRuleSchema,
  updateCategorizationRuleSchema,
} from '@/lib/validation/categorization-rule'
import {
  type ActionResult,
  toFieldErrors,
  UNEXPECTED,
  VALIDATION_FAILED,
} from '@/lib/validation/form'
import { listTxnsForPreview } from './data'

export type { ActionResult }

const RULES_PATH = '/protected/settings/rules'

/** Parse a JSON string field (conditions) without throwing. */
function parseJson(value: FormDataEntryValue | null): unknown {
  if (typeof value !== 'string') {
    return undefined
  }
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

export async function createRule(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const claims = await requireUser()

  const parsed = createCategorizationRuleSchema.safeParse({
    name: formData.get('name'),
    conditions: parseJson(formData.get('conditions')),
    categoryId: formData.get('categoryId'),
    priority: Number(formData.get('priority') ?? 0),
    enabled: formData.get('enabled') === 'on',
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
    const { error } = await supabase.from('categorization_rules').insert({
      user_id: claims.sub,
      name: parsed.data.name,
      conditions: parsed.data.conditions,
      category_id: parsed.data.categoryId,
      priority: parsed.data.priority,
      enabled: parsed.data.enabled,
      is_default: false,
      name_key: null,
    })
    if (error) {
      return { ok: false, error: UNEXPECTED }
    }
  } catch {
    return { ok: false, error: UNEXPECTED }
  }

  revalidatePath(RULES_PATH)
  return { ok: true }
}

export async function updateRule(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  await requireUser()

  const parsed = updateCategorizationRuleSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name') ?? undefined,
    conditions: parseJson(formData.get('conditions')),
    categoryId: formData.get('categoryId') ?? undefined,
    priority: Number(formData.get('priority') ?? 0),
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
    const { data: current } = await supabase
      .from('categorization_rules')
      .select('id, name_key')
      .eq('id', parsed.data.id)
      .maybeSingle()
    if (!current) {
      return { ok: false, error: UNEXPECTED }
    }

    const update: Record<string, unknown> = {}
    if (parsed.data.conditions !== undefined) {
      update.conditions = parsed.data.conditions
    }
    if (parsed.data.categoryId !== undefined) {
      update.category_id = parsed.data.categoryId
    }
    if (parsed.data.priority !== undefined) {
      update.priority = parsed.data.priority
    }
    // Renaming is the default→custom conversion signal (mirrors categories).
    if (parsed.data.name !== undefined) {
      update.name = parsed.data.name
      if (current.name_key !== null) {
        update.name_key = null
      }
    }

    const { error } = await supabase
      .from('categorization_rules')
      .update(update)
      .eq('id', parsed.data.id)
    if (error) {
      return { ok: false, error: UNEXPECTED }
    }
  } catch {
    return { ok: false, error: UNEXPECTED }
  }

  revalidatePath(RULES_PATH)
  return { ok: true }
}

export async function deleteRule(id: string): Promise<ActionResult> {
  await requireUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: UNEXPECTED }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from('categorization_rules')
    .delete()
    .eq('id', id)
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }
  revalidatePath(RULES_PATH)
  return { ok: true }
}

export async function toggleRule(
  id: string,
  enabled: boolean
): Promise<ActionResult> {
  await requireUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: UNEXPECTED }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from('categorization_rules')
    .update({ enabled })
    .eq('id', id)
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }
  revalidatePath(RULES_PATH)
  return { ok: true }
}

export interface PreviewResult {
  matched: number
  rows: { description: string; amountCents: number }[]
  total: number
}

/**
 * "Test this rule against your data" (P3-06). Validates the candidate
 * conditions, runs the pure `previewRuleMatches` over the user's transactions
 * (RLS-scoped), and returns counts + a capped sample. Writes nothing.
 */
export async function previewRule(
  conditions: unknown
): Promise<PreviewResult | { error: string }> {
  await requireUser()
  const parsed = conditionsSchema.safeParse(conditions)
  if (!parsed.success) {
    return { error: VALIDATION_FAILED }
  }
  try {
    const txns = await listTxnsForPreview()
    const result = previewRuleMatches(parsed.data, txns, { limit: 20 })
    return {
      matched: result.matched,
      total: result.total,
      rows: result.rows.map((r) => ({
        description: r.description,
        amountCents: r.amountCents,
      })),
    }
  } catch {
    return { error: UNEXPECTED }
  }
}
