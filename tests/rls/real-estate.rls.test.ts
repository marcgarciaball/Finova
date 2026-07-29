import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * RLS isolation tests for the real-estate tables (`properties`,
 * `rental_income`, `property_expenses`, `property_valuations`), mirroring
 * `accounts.rls.test.ts`. Mortgage loans now live in the generic `debts`
 * table (`type = 'mortgage'`) — see `debts.rls.test.ts` for the debts-table
 * isolation tests, standalone and property-attached.
 *
 * Proves a user can only see and mutate their own rows. Requires a real
 * Postgres — SKIPPED unless TEST_DATABASE_URL points at a disposable database;
 * never run against production data.
 *
 *   TEST_DATABASE_URL="postgresql://...:5432/postgres" npm test -- rls
 *
 * The owner connection (bypasses RLS) seeds rows; queries then run inside a
 * transaction downgraded to the `authenticated` role with the JWT `sub` claim
 * set, so `auth.uid()` resolves to the simulated user.
 */
const url = process.env.TEST_DATABASE_URL
const USER_A = '00000000-0000-0000-0000-0000000000aa'
const USER_B = '00000000-0000-0000-0000-0000000000ab'

const CHILD_TABLES = [
  'rental_income',
  'property_expenses',
  'property_valuations',
] as const

describe.skipIf(!url)('real estate RLS', () => {
  const sql = postgres(url as string, { prepare: false })

  let propertyA = ''
  let propertyB = ''

  /** Run `fn` as the given user with RLS enforced; always rolled back. */
  async function asUser<T>(
    uid: string,
    fn: (tx: postgres.TransactionSql) => Promise<T>
  ): Promise<T> {
    const result = await sql.begin(async (tx) => {
      await tx`select set_config('role', 'authenticated', true)`
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: uid })}, true)`
      return fn(tx as unknown as postgres.TransactionSql)
    })
    return result as T
  }

  async function seedProperty(userId: string, name: string): Promise<string> {
    const [row] = await sql`
      insert into public.properties
        (user_id, name, type, purchase_date, purchase_price_cents,
         current_value_cents, last_valued_at)
      values (${userId}, ${name}, 'investment', '2020-01-15', 20000000,
              25000000, '2026-01-01')
      returning id`
    return row?.id as string
  }

  beforeAll(async () => {
    for (const id of [USER_A, USER_B]) {
      await sql`insert into auth.users (id, email) values (${id}, ${`${id}@test.local`}) on conflict (id) do nothing`
    }
    await sql`delete from public.properties where user_id in (${USER_A}, ${USER_B})`
    propertyA = await seedProperty(USER_A, 'A flat')
    propertyB = await seedProperty(USER_B, 'B flat')
    await sql`
      insert into public.debts
        (user_id, property_id, type, lender, currency, principal_cents,
         outstanding_cents, interest_rate_pct, rate_type, term_months,
         start_date, payment_cents)
      values (${USER_B}, ${propertyB}, 'mortgage', 'B Bank', 'EUR', 16000000,
              12000000, 3.250, 'fixed', 240, '2020-01-15', 80000)`
    await sql`
      insert into public.rental_income
        (user_id, property_id, period_start, period_end, amount_cents)
      values (${USER_B}, ${propertyB}, '2026-01-01', '2026-01-31', 120000)`
    await sql`
      insert into public.property_expenses
        (user_id, property_id, category, description, amount_cents, expense_date)
      values (${USER_B}, ${propertyB}, 'property_tax', 'IBI', 45000, '2026-01-10')`
    await sql`
      insert into public.property_valuations
        (user_id, property_id, valuation_date, value_cents)
      values (${USER_B}, ${propertyB}, '2026-01-01', 26000000)`
  })

  afterAll(async () => {
    await sql`delete from auth.users where id in (${USER_A}, ${USER_B})` // cascades to all real-estate rows
    await sql.end()
  })

  it('A sees only its own properties', async () => {
    const rows = await asUser(
      USER_A,
      (tx) => tx`select user_id from public.properties`
    )
    expect(rows.map((r) => r.user_id)).toEqual([USER_A])
  })

  for (const table of CHILD_TABLES) {
    it(`A cannot read B's rows in ${table}`, async () => {
      const rows = await asUser(
        USER_A,
        (tx) => tx`select id from ${tx(`public.${table}`)}`
      )
      expect(rows).toHaveLength(0)
    })
  }

  it("A cannot read B's mortgage debt", async () => {
    const rows = await asUser(
      USER_A,
      (tx) => tx`select id from public.debts where property_id = ${propertyB}`
    )
    expect(rows).toHaveLength(0)
  })

  it("A cannot update B's property", async () => {
    const updated = await asUser(
      USER_A,
      (tx) =>
        tx`update public.properties set name = 'hijacked' where user_id = ${USER_B} returning id`
    )
    expect(updated).toHaveLength(0)
  })

  it("A cannot delete B's property", async () => {
    const deleted = await asUser(
      USER_A,
      (tx) =>
        tx`delete from public.properties where user_id = ${USER_B} returning id`
    )
    expect(deleted).toHaveLength(0)
  })

  it('A cannot insert a property owned by B', async () => {
    await expect(
      asUser(
        USER_A,
        (tx) => tx`
          insert into public.properties
            (user_id, name, type, purchase_date, purchase_price_cents,
             current_value_cents, last_valued_at)
          values (${USER_B}, 'spoof', 'investment', '2020-01-15', 1000,
                  1000, '2026-01-01')`
      )
    ).rejects.toThrow()
  })

  it("A cannot attach a mortgage debt to B's property, even self-owned", async () => {
    await expect(
      asUser(
        USER_A,
        (tx) => tx`
          insert into public.debts
            (user_id, property_id, type, lender, currency, principal_cents,
             outstanding_cents, interest_rate_pct, rate_type, term_months,
             start_date, payment_cents)
          values (${USER_A}, ${propertyB}, 'mortgage', 'Spoof Bank', 'EUR',
                  1000, 1000, 1.000, 'fixed', 12, '2020-01-15', 100)`
      )
      // Insert passes the debts policy (user_id = A) but the FK lookup on
      // B's property fails under RLS, so the row is rejected.
    ).rejects.toThrow()
  })

  it('A can insert, update and delete its own full property graph', async () => {
    await asUser(USER_A, async (tx) => {
      const [loan] = await tx`
        insert into public.debts
          (user_id, property_id, type, lender, currency, principal_cents,
           outstanding_cents, interest_rate_pct, rate_type, term_months,
           start_date, payment_cents)
        values (${USER_A}, ${propertyA}, 'mortgage', 'A Bank', 'EUR', 16000000,
                15000000, 2.500, 'variable', 240, '2020-01-15', 70000)
        returning id`
      expect(loan?.id).toBeTruthy()

      const [income] = await tx`
        insert into public.rental_income
          (user_id, property_id, period_start, period_end, amount_cents)
        values (${USER_A}, ${propertyA}, '2026-02-01', '2026-02-28', 110000)
        returning id`
      expect(income?.id).toBeTruthy()

      const [expense] = await tx`
        insert into public.property_expenses
          (user_id, property_id, category, description, amount_cents, expense_date)
        values (${USER_A}, ${propertyA}, 'community_fee', 'Comunidad', 12000, '2026-02-05')
        returning id`
      expect(expense?.id).toBeTruthy()

      const [valuation] = await tx`
        insert into public.property_valuations
          (user_id, property_id, valuation_date, value_cents)
        values (${USER_A}, ${propertyA}, '2026-02-01', 25500000)
        returning id`
      expect(valuation?.id).toBeTruthy()

      const updated = await tx`
        update public.debts set outstanding_cents = 14900000
        where id = ${loan?.id} returning id`
      expect(updated).toHaveLength(1)

      const deleted = await tx`
        delete from public.rental_income where id = ${income?.id} returning id`
      expect(deleted).toHaveLength(1)
    })
  })
})
