import { sql } from 'drizzle-orm'
import {
  check,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase'

/**
 * profiles (P0-07) — one row per auth user, holding app-level preferences.
 *
 * Ownership column is `id` itself (= auth.uid()). RLS is default-deny: a user
 * can only ever see and edit their own row. There is no DELETE policy — profile
 * removal happens via account deletion (P5-02), which cascades from auth.users.
 *
 * `(select auth.uid())` (rather than bare `auth.uid()`) lets Postgres cache the
 * value per statement — the form Supabase recommends for RLS performance.
 */
export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    baseCurrency: text('base_currency').notNull().default('EUR'),
    displayCurrency: text('display_currency').notNull().default('EUR'),
    locale: text('locale').notNull().default('es'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('profiles_locale_check', sql`${table.locale} in ('es', 'en')`),
    check(
      'profiles_base_currency_check',
      sql`${table.baseCurrency} ~ '^[A-Z]{3}$'`
    ),
    check(
      'profiles_display_currency_check',
      sql`${table.displayCurrency} ~ '^[A-Z]{3}$'`
    ),
    pgPolicy('profiles_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.id}`,
    }),
    pgPolicy('profiles_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = ${table.id}`,
    }),
    pgPolicy('profiles_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.id}`,
      withCheck: sql`(select auth.uid()) = ${table.id}`,
    }),
  ]
)

export type Profile = typeof profiles.$inferSelect
export type NewProfile = typeof profiles.$inferInsert
