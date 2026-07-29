import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  date,
  index,
  numeric,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase'
import { properties } from './real-estate'

/**
 * Generic debts: mortgages, car loans, personal loans, credit cards. All
 * money is integer cents in the row's own currency; cross-currency
 * aggregation happens in the domain layer. `outstandingCents` is the
 * user-maintained current balance, same pattern as Manual Assets'
 * `currentValueCents` — real loans drift from a textbook amortization
 * schedule (rate changes, extra payments), so there's no way to hand-correct
 * a pure formula. The amortization fields (`principalCents`,
 * `interestRatePct`, `termMonths`, `startDate`, `paymentCents`) feed only a
 * reference schedule/payoff projection, never the balance itself.
 */
export const debts = pgTable(
  'debts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    propertyId: uuid('property_id').references(() => properties.id, {
      onDelete: 'set null',
    }),
    lender: text('lender').notNull(),
    currency: text('currency').notNull().default('EUR'),
    principalCents: bigint('principal_cents', { mode: 'number' }).notNull(),
    outstandingCents: bigint('outstanding_cents', {
      mode: 'number',
    }).notNull(),
    interestRatePct: numeric('interest_rate_pct', {
      precision: 6,
      scale: 3,
    }).notNull(),
    rateType: text('rate_type').notNull(),
    termMonths: bigint('term_months', { mode: 'number' }).notNull(),
    startDate: date('start_date').notNull(),
    paymentCents: bigint('payment_cents', { mode: 'number' }).notNull(),
    status: text('status').notNull().default('active'),
    notes: text('notes'),
    importFingerprint: text('import_fingerprint'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('debts_user_fingerprint_unique')
      .on(table.userId, table.importFingerprint)
      .where(sql`${table.importFingerprint} is not null`),
    check(
      'debts_type_check',
      sql`${table.type} in ('mortgage', 'car_loan', 'personal_loan', 'credit_card', 'other')`
    ),
    check(
      'debts_property_id_check',
      sql`${table.propertyId} is null or ${table.type} = 'mortgage'`
    ),
    check(
      'debts_rate_type_check',
      sql`${table.rateType} in ('fixed', 'variable', 'mixed')`
    ),
    check(
      'debts_status_check',
      sql`${table.status} in ('active', 'paid_off', 'defaulted')`
    ),
    check('debts_currency_check', sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check('debts_principal_check', sql`${table.principalCents} >= 0`),
    check('debts_outstanding_check', sql`${table.outstandingCents} >= 0`),
    check('debts_term_months_check', sql`${table.termMonths} > 0`),
    check('debts_payment_check', sql`${table.paymentCents} >= 0`),
    index('debts_user_id_idx').on(table.userId),
    index('debts_property_id_idx').on(table.propertyId),
    pgPolicy('debts_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('debts_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('debts_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('debts_delete_own', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
  ]
)
