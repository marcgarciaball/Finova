/**
 * Schema barrel. Every table module is re-exported here; this file is the
 * single entry point drizzle.config.ts points at.
 */
export * from '@/lib/db/schema/accounts'
export * from '@/lib/db/schema/categories'
export * from '@/lib/db/schema/import-batches'
export * from '@/lib/db/schema/import-templates'
export * from '@/lib/db/schema/profiles'
export * from '@/lib/db/schema/transactions'
