/**
 * Schema barrel. Every table module is re-exported here; this file is the
 * single entry point drizzle.config.ts points at.
 */
export * from '@/lib/db/schema/accounts'
export * from '@/lib/db/schema/categories'
export * from '@/lib/db/schema/categorization-rules'
export * from '@/lib/db/schema/import-batches'
export * from '@/lib/db/schema/import-templates'
export * from '@/lib/db/schema/investments-derived'
export * from '@/lib/db/schema/investments-portfolios'
export * from '@/lib/db/schema/investments-reference'
export * from '@/lib/db/schema/investments-transactions'
export * from '@/lib/db/schema/profiles'
export * from '@/lib/db/schema/real-estate'
export * from '@/lib/db/schema/sync-state'
export * from '@/lib/db/schema/transactions'
