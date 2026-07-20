import { sql } from 'drizzle-orm'
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Self-hosted error tracking (P5-05). Written by the service-role client only
 * (`captureError` in lib/observability/) from `instrumentation.ts` and
 * `app/api/log-error`; RLS enabled with no policies, so it's invisible to
 * every client request — mirrors `sync_state`. No third-party error service.
 */
export const errorLogs = pgTable(
  'error_logs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    level: text('level').notNull().default('error'),
    message: text('message').notNull(),
    digest: text('digest'), // Next.js error digest — correlates to what the user saw
    stack: text('stack'),
    context: jsonb('context'), // { path, userId, ... } — free-form, never PII beyond userId
  },
  (table) => [
    check(
      'error_logs_level_check',
      sql`${table.level} in ('info', 'warn', 'error')`
    ),
    index('error_logs_occurred_at_idx').on(table.occurredAt),
  ]
).enableRLS()
