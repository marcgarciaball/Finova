import { z } from 'zod'
import { CATEGORY_KINDS } from '@/lib/domain/categories/types'

/**
 * Category validation (P1-03).
 *
 * Input schemas validate what a (future) category form sends; `categoryRowSchema`
 * is the single source of truth for the runtime shape of a Supabase row, parsed
 * at the data boundary. `name_key` is only ever set by the seed (defaults), so
 * input schemas don't accept it — user-created categories are always custom.
 */
export const categoryKindSchema = z.enum(CATEGORY_KINDS)

const nameSchema = z
  .string()
  .trim()
  .min(1, 'nameRequired')
  .max(100, 'nameTooLong')

/**
 * `parentId` is optional: omitted/empty → a top-level category; a uuid → a
 * subcategory. The action layer additionally checks the parent is owned by the
 * caller, shares the kind, and is itself top-level (one-level nesting).
 */
const parentIdSchema = z
  .string()
  .uuid()
  .nullish()
  .or(z.literal('').transform(() => null))

export const createCategorySchema = z.object({
  name: nameSchema,
  kind: categoryKindSchema,
  parentId: parentIdSchema,
})

export const updateCategorySchema = createCategorySchema.extend({
  id: z.string().uuid(),
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>

/** Parse a raw Supabase `categories` row into a typed, validated domain shape. */
export const categoryRowSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  parent_id: z.string().min(1).nullable(),
  name: z.string(),
  name_key: z.string().nullable(),
  kind: categoryKindSchema,
  is_default: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type CategoryRow = z.infer<typeof categoryRowSchema>
