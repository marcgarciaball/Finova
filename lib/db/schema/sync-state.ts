import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * Provider-sync bookkeeping (Inversiones). Keys like `history:<asset_id>` or
 * `fx:USD->EUR` record the last sync ATTEMPT, so slow-moving EOD data (which
 * is legitimately 1–3 days behind) doesn't retrigger downloads every refresh
 * and burn free-tier API quota. RLS enabled with no policies: service-role
 * only, invisible to clients.
 */
export const syncState = pgTable('sync_state', {
  key: text('key').primaryKey(),
  syncedAt: timestamp('synced_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS()
