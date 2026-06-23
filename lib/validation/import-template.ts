import { z } from 'zod'
import { currencySchema } from '@/lib/validation/account'

/**
 * Import-template validation (P2-03).
 *
 * `columnMappingSchema` is the runtime source of truth for the `ColumnMapping`
 * stored in the `import_templates.mapping` jsonb column — the column trusts
 * nothing, so every save validates against this before write. The schema is
 * kept structurally in lockstep with the `ColumnMapping` type in
 * `lib/domain/import/mapping.ts`. `saveTemplateSchema` validates what the save
 * form sends (name + header signature + mapping).
 */

const columnRefSchema = z.object({
  column: z.string().trim().min(1, 'columnRequired'),
})

const dateFormatSchema = z.enum(['dmy', 'mdy', 'ymd', 'auto'])
const decimalSchema = z.enum([',', '.'])

const dateMappingSchema = z.object({
  column: z.string().trim().min(1, 'columnRequired'),
  format: dateFormatSchema.optional(),
})

const amountMappingSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('single'),
    column: z.string().trim().min(1, 'columnRequired'),
    decimal: decimalSchema.optional(),
    negativeIs: z.enum(['expense', 'income']),
  }),
  z.object({
    kind: z.literal('debitCredit'),
    debitColumn: z.string().trim().min(1, 'columnRequired'),
    creditColumn: z.string().trim().min(1, 'columnRequired'),
    decimal: decimalSchema.optional(),
  }),
])

const currencyMappingSchema = z.union([
  z.object({ column: z.string().trim().min(1, 'columnRequired') }).strict(),
  z.object({ fixed: currencySchema }).strict(),
])

export const columnMappingSchema = z
  .object({
    date: dateMappingSchema,
    amount: amountMappingSchema,
    description: columnRefSchema,
    note: columnRefSchema.optional(),
    currency: currencyMappingSchema.optional(),
  })
  .strip()

export const saveTemplateSchema = z.object({
  name: z.string().trim().min(1, 'nameRequired').max(100, 'nameTooLong'),
  signature: z.string().trim().min(1, 'signatureRequired'),
  mapping: columnMappingSchema,
})

export type ColumnMappingInput = z.infer<typeof columnMappingSchema>
export type SaveTemplateInput = z.infer<typeof saveTemplateSchema>

/** Parse a raw Supabase `import_templates` row into a typed, validated shape. */
export const importTemplateRowSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  header_signature: z.string(),
  name: z.string(),
  mapping: columnMappingSchema,
  created_at: z.string(),
  updated_at: z.string(),
})

export type ImportTemplateRow = z.infer<typeof importTemplateRowSchema>
