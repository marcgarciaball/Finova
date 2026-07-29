import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  date,
  index,
  numeric,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase'

/**
 * Real Estate (property portfolio). All money is integer cents in the row's
 * own currency; cross-currency aggregation happens in the domain layer.
 * Valuations are manual snapshots — `properties.current_value_cents` mirrors
 * the latest one for cheap reads.
 */
export const properties = pgTable(
  'properties',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(),
    address: text('address'),
    city: text('city'),
    country: text('country').notNull().default('ES'),
    currency: text('currency').notNull().default('EUR'),
    purchaseDate: date('purchase_date').notNull(),
    purchasePriceCents: bigint('purchase_price_cents', {
      mode: 'number',
    }).notNull(),
    transferTaxCents: bigint('transfer_tax_cents', { mode: 'number' })
      .notNull()
      .default(0),
    notaryCents: bigint('notary_cents', { mode: 'number' })
      .notNull()
      .default(0),
    registryCents: bigint('registry_cents', { mode: 'number' })
      .notNull()
      .default(0),
    agencyFeeCents: bigint('agency_fee_cents', { mode: 'number' })
      .notNull()
      .default(0),
    renovationCostCents: bigint('renovation_cost_cents', { mode: 'number' })
      .notNull()
      .default(0),
    otherPurchaseCostsCents: bigint('other_purchase_costs_cents', {
      mode: 'number',
    })
      .notNull()
      .default(0),
    currentValueCents: bigint('current_value_cents', {
      mode: 'number',
    }).notNull(),
    lastValuedAt: date('last_valued_at').notNull(),
    ownershipPct: numeric('ownership_pct', { precision: 5, scale: 2 })
      .notNull()
      .default('100'),
    isRented: boolean('is_rented').notNull().default(false),
    rentalStartDate: date('rental_start_date'),
    rentalEndDate: date('rental_end_date'),
    currentRentCents: bigint('current_rent_cents', { mode: 'number' }),
    isSold: boolean('is_sold').notNull().default(false),
    soldDate: date('sold_date'),
    soldPriceCents: bigint('sold_price_cents', { mode: 'number' }),
    soldFeesCents: bigint('sold_fees_cents', { mode: 'number' }).default(0),
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
    uniqueIndex('properties_user_fingerprint_unique')
      .on(table.userId, table.importFingerprint)
      .where(sql`${table.importFingerprint} is not null`),
    check(
      'properties_type_check',
      sql`${table.type} in ('primary_home', 'investment', 'vacation', 'land', 'commercial', 'other')`
    ),
    check('properties_currency_check', sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      'properties_purchase_price_check',
      sql`${table.purchasePriceCents} >= 0`
    ),
    check('properties_transfer_tax_check', sql`${table.transferTaxCents} >= 0`),
    check('properties_notary_check', sql`${table.notaryCents} >= 0`),
    check('properties_registry_check', sql`${table.registryCents} >= 0`),
    check('properties_agency_fee_check', sql`${table.agencyFeeCents} >= 0`),
    check(
      'properties_renovation_cost_check',
      sql`${table.renovationCostCents} >= 0`
    ),
    check(
      'properties_other_purchase_costs_check',
      sql`${table.otherPurchaseCostsCents} >= 0`
    ),
    check(
      'properties_current_value_check',
      sql`${table.currentValueCents} >= 0`
    ),
    check(
      'properties_ownership_pct_check',
      sql`${table.ownershipPct} > 0 and ${table.ownershipPct} <= 100`
    ),
    check(
      'properties_current_rent_check',
      sql`${table.currentRentCents} is null or ${table.currentRentCents} >= 0`
    ),
    index('properties_user_id_idx').on(table.userId),
    pgPolicy('properties_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('properties_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('properties_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('properties_delete_own', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
  ]
)

/**
 * Loans secured against a property. A property can carry several (mortgage +
 * equity release). `outstanding_cents` is the user-maintained current balance.
 */
export const propertyLoans = pgTable(
  'property_loans',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    lenderName: text('lender_name').notNull(),
    loanType: text('loan_type').notNull(),
    currency: text('currency').notNull().default('EUR'),
    originalAmountCents: bigint('original_amount_cents', {
      mode: 'number',
    }).notNull(),
    outstandingCents: bigint('outstanding_cents', { mode: 'number' }).notNull(),
    interestRatePct: numeric('interest_rate_pct', {
      precision: 6,
      scale: 3,
    }).notNull(),
    rateType: text('rate_type').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    monthlyPaymentCents: bigint('monthly_payment_cents', {
      mode: 'number',
    }).notNull(),
    euriborSpreadPct: numeric('euribor_spread_pct', {
      precision: 6,
      scale: 3,
    }),
    lastReviewDate: date('last_review_date'),
    notes: text('notes'),
    isPaidOff: boolean('is_paid_off').notNull().default(false),
    importFingerprint: text('import_fingerprint'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('property_loans_user_fingerprint_unique')
      .on(table.userId, table.importFingerprint)
      .where(sql`${table.importFingerprint} is not null`),
    check(
      'property_loans_loan_type_check',
      sql`${table.loanType} in ('mortgage', 'equity_release', 'personal_loan', 'developer_loan', 'other')`
    ),
    check(
      'property_loans_rate_type_check',
      sql`${table.rateType} in ('fixed', 'variable', 'mixed')`
    ),
    check(
      'property_loans_currency_check',
      sql`${table.currency} ~ '^[A-Z]{3}$'`
    ),
    check(
      'property_loans_original_amount_check',
      sql`${table.originalAmountCents} >= 0`
    ),
    check(
      'property_loans_outstanding_check',
      sql`${table.outstandingCents} >= 0`
    ),
    check(
      'property_loans_monthly_payment_check',
      sql`${table.monthlyPaymentCents} >= 0`
    ),
    index('property_loans_user_id_idx').on(table.userId),
    index('property_loans_property_id_idx').on(table.propertyId),
    pgPolicy('property_loans_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('property_loans_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('property_loans_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('property_loans_delete_own', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
  ]
)

/**
 * Rental income events — one row per rental period or payment received.
 */
export const rentalIncome = pgTable(
  'rental_income',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    currency: text('currency').notNull().default('EUR'),
    tenantName: text('tenant_name'),
    isPaid: boolean('is_paid').notNull().default(true),
    notes: text('notes'),
    importFingerprint: text('import_fingerprint'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('rental_income_user_fingerprint_unique')
      .on(table.userId, table.importFingerprint)
      .where(sql`${table.importFingerprint} is not null`),
    check(
      'rental_income_currency_check',
      sql`${table.currency} ~ '^[A-Z]{3}$'`
    ),
    check('rental_income_amount_check', sql`${table.amountCents} >= 0`),
    check(
      'rental_income_period_check',
      sql`${table.periodEnd} >= ${table.periodStart}`
    ),
    index('rental_income_user_id_idx').on(table.userId),
    index('rental_income_property_id_idx').on(table.propertyId),
    pgPolicy('rental_income_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('rental_income_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('rental_income_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('rental_income_delete_own', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
  ]
)

/**
 * Property running costs: taxes, community fees, insurance, maintenance…
 */
export const propertyExpenses = pgTable(
  'property_expenses',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    description: text('description').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    currency: text('currency').notNull().default('EUR'),
    expenseDate: date('expense_date').notNull(),
    isRecurring: boolean('is_recurring').notNull().default(false),
    recurrence: text('recurrence'),
    notes: text('notes'),
    importFingerprint: text('import_fingerprint'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('property_expenses_user_fingerprint_unique')
      .on(table.userId, table.importFingerprint)
      .where(sql`${table.importFingerprint} is not null`),
    check(
      'property_expenses_category_check',
      sql`${table.category} in ('mortgage_payment', 'property_tax', 'community_fee', 'insurance', 'maintenance', 'management_fee', 'utilities', 'legal', 'renovation', 'vacancy', 'other')`
    ),
    check(
      'property_expenses_recurrence_check',
      sql`${table.recurrence} is null or ${table.recurrence} in ('monthly', 'quarterly', 'yearly')`
    ),
    check(
      'property_expenses_currency_check',
      sql`${table.currency} ~ '^[A-Z]{3}$'`
    ),
    check('property_expenses_amount_check', sql`${table.amountCents} >= 0`),
    index('property_expenses_user_id_idx').on(table.userId),
    index('property_expenses_property_id_idx').on(table.propertyId),
    pgPolicy('property_expenses_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('property_expenses_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('property_expenses_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('property_expenses_delete_own', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
  ]
)

/**
 * Manual valuation history — one snapshot per property per date, so value
 * growth can be charted over time.
 */
export const propertyValuations = pgTable(
  'property_valuations',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    valuationDate: date('valuation_date').notNull(),
    valueCents: bigint('value_cents', { mode: 'number' }).notNull(),
    source: text('source').default('manual'),
    notes: text('notes'),
    importFingerprint: text('import_fingerprint'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('property_valuations_property_date_unique').on(
      table.propertyId,
      table.valuationDate
    ),
    uniqueIndex('property_valuations_user_fingerprint_unique')
      .on(table.userId, table.importFingerprint)
      .where(sql`${table.importFingerprint} is not null`),
    check(
      'property_valuations_source_check',
      sql`${table.source} is null or ${table.source} in ('manual', 'appraisal', 'agent_estimate', 'zillow', 'idealista', 'other')`
    ),
    check('property_valuations_value_check', sql`${table.valueCents} >= 0`),
    index('property_valuations_user_id_idx').on(table.userId),
    index('property_valuations_property_id_idx').on(table.propertyId),
    pgPolicy('property_valuations_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('property_valuations_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('property_valuations_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('property_valuations_delete_own', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
  ]
)
