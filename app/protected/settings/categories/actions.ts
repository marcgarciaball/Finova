'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import {
  createCategorySchema,
  updateCategorySchema,
} from '@/lib/validation/category'
import {
  type ActionResult,
  toFieldErrors,
  UNEXPECTED,
  VALIDATION_FAILED,
} from '@/lib/validation/form'

export type { ActionResult }

const CATEGORIES_PATH = '/protected/settings/categories'
const INVALID_PARENT = 'invalidParent'

/**
 * CRUD Server Actions for categories (P5-01). Every action `requireUser()`
 * first, derives the owner from the JWT, and writes through the RLS-enforced
 * client. Parent ownership / same-kind / one-level-nesting are checked in the
 * app layer because FK checks bypass RLS (per the P1-03 notes).
 */

/** Validate a chosen parent: owned (RLS), top-level, and the same kind. */
async function parentIsValid(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parentId: string,
  kind: string
): Promise<boolean> {
  const { data } = await supabase
    .from('categories')
    .select('id, parent_id, kind')
    .eq('id', parentId)
    .maybeSingle()
  return Boolean(data) && data?.parent_id === null && data?.kind === kind
}

export async function createCategory(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const claims = await requireUser()

  const parsed = createCategorySchema.safeParse({
    name: formData.get('name'),
    kind: formData.get('kind'),
    parentId: formData.get('parentId') ?? undefined,
    iconName: formData.get('iconName') ?? undefined,
    color: formData.get('color') ?? undefined,
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
      parsed.data.parentId &&
      !(await parentIsValid(supabase, parsed.data.parentId, parsed.data.kind))
    ) {
      return { ok: false, error: INVALID_PARENT }
    }
    const { error } = await supabase.from('categories').insert({
      user_id: claims.sub,
      name: parsed.data.name,
      kind: parsed.data.kind,
      parent_id: parsed.data.parentId ?? null,
      icon_name: parsed.data.iconName ?? null,
      color: parsed.data.color ?? null,
      is_default: false,
      name_key: null,
    })
    if (error) {
      return { ok: false, error: UNEXPECTED }
    }
  } catch {
    return { ok: false, error: UNEXPECTED }
  }

  revalidatePath(CATEGORIES_PATH)
  return { ok: true }
}

export async function updateCategory(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  await requireUser()

  const parsed = updateCategorySchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name') ?? undefined,
    parentId: formData.get('parentId') ?? undefined,
    iconName: formData.get('iconName') ?? undefined,
    color: formData.get('color') ?? undefined,
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
    // Load the current row (RLS-scoped) — its kind drives parent validation and
    // its name_key drives the default→custom conversion.
    const { data: current } = await supabase
      .from('categories')
      .select('id, kind, name_key, parent_id')
      .eq('id', parsed.data.id)
      .maybeSingle()
    if (!current) {
      return { ok: false, error: UNEXPECTED }
    }

    if (parsed.data.parentId) {
      if (parsed.data.parentId === parsed.data.id) {
        return { ok: false, error: INVALID_PARENT }
      }
      // Re-parenting a row that itself has children would create 3 levels.
      const { count } = await supabase
        .from('categories')
        .select('id', { count: 'exact', head: true })
        .eq('parent_id', parsed.data.id)
      if (
        (count ?? 0) > 0 ||
        !(await parentIsValid(
          supabase,
          parsed.data.parentId,
          String(current.kind)
        ))
      ) {
        return { ok: false, error: INVALID_PARENT }
      }
    }

    const update: Record<string, unknown> = {
      parent_id: parsed.data.parentId ?? null,
      icon_name: parsed.data.iconName ?? null,
      color: parsed.data.color ?? null,
    }
    // Renaming is opt-in: `name` is only present when the user edited it. On a
    // default (name_key != null) that presence converts it to a custom category.
    if (parsed.data.name !== undefined) {
      update.name = parsed.data.name
      if (current.name_key !== null) {
        update.name_key = null
      }
    }

    const { error } = await supabase
      .from('categories')
      .update(update)
      .eq('id', parsed.data.id)
    if (error) {
      return { ok: false, error: UNEXPECTED }
    }
  } catch {
    return { ok: false, error: UNEXPECTED }
  }

  revalidatePath(CATEGORIES_PATH)
  return { ok: true }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: UNEXPECTED }
  }

  // FK behavior does the rest: transactions.category_id → SET NULL (rows
  // un-categorize), categorization_rules.category_id → CASCADE (rule removed),
  // and child categories cascade via the parent_id self-ref.
  const supabase = await createClient()
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) {
    return { ok: false, error: UNEXPECTED }
  }

  revalidatePath(CATEGORIES_PATH)
  return { ok: true }
}
