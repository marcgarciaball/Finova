import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * RLS isolation tests for standalone debts (`debts` rows with `property_id =
 * null`, e.g. car loans, personal loans, credit cards) — mirrors
 * `real-estate.rls.test.ts`'s structure, but for the generic debts table on
 * its own, not attached to a property.
 *
 * Proves a user can only see and mutate their own debts, and that spoofing
 * `user_id` on insert doesn't work. Requires a real Postgres — SKIPPED unless
 * TEST_DATABASE_URL points at a disposable database; never run against
 * production data.
 *
 *   TEST_DATABASE_URL="postgresql://...:5432/postgres" npm test -- rls
 *
 * The owner connection (bypasses RLS) seeds rows; queries then run inside a
 * transaction downgraded to the `authenticated` role with the JWT `sub` claim
 * set, so `auth.uid()` resolves to the simulated user.
 */
const url = process.env.TEST_DATABASE_URL
const USER_A = '00000000-0000-0000-0000-0000000000ba'
const USER_B = '00000000-0000-0000-0000-0000000000bb'

describe.skipIf(!url)('debts RLS', () => {
  const sql = postgres(url as string, { prepare: false })

  let debtB = ''

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

  beforeAll(async () => {
    for (const id of [USER_A, USER_B]) {
      await sql`insert into auth.users (id, email) values (${id}, ${`${id}@test.local`}) on conflict (id) do nothing`
    }
    await sql`delete from public.debts where user_id in (${USER_A}, ${USER_B})`
    const [row] = await sql`
      insert into public.debts
        (user_id, property_id, type, lender, currency, principal_cents,
         outstanding_cents, interest_rate_pct, rate_type, term_months,
         start_date, payment_cents)
      values (${USER_B}, null, 'car_loan', 'B Auto Finance', 'EUR', 2000000,
              1500000, 6.500, 'fixed', 60, '2024-06-01', 32000)
      returning id`
    debtB = row?.id as string
  })

  afterAll(async () => {
    await sql`delete from auth.users where id in (${USER_A}, ${USER_B})` // cascades to debts
    await sql.end()
  })

  it('A sees only its own debts', async () => {
    const rows = await asUser(
      USER_A,
      (tx) => tx`select user_id from public.debts`
    )
    expect(rows).toHaveLength(0)
  })

  it("A cannot read B's debt", async () => {
    const rows = await asUser(
      USER_A,
      (tx) => tx`select id from public.debts where id = ${debtB}`
    )
    expect(rows).toHaveLength(0)
  })

  it("A cannot update B's debt", async () => {
    const updated = await asUser(
      USER_A,
      (tx) =>
        tx`update public.debts set outstanding_cents = 1 where id = ${debtB} returning id`
    )
    expect(updated).toHaveLength(0)
  })

  it("A cannot delete B's debt", async () => {
    const deleted = await asUser(
      USER_A,
      (tx) => tx`delete from public.debts where id = ${debtB} returning id`
    )
    expect(deleted).toHaveLength(0)
  })

  it('A cannot insert a debt claiming user_id = B (spoofing)', async () => {
    await expect(
      asUser(
        USER_A,
        (tx) => tx`
          insert into public.debts
            (user_id, property_id, type, lender, currency, principal_cents,
             outstanding_cents, interest_rate_pct, rate_type, term_months,
             start_date, payment_cents)
          values (${USER_B}, null, 'personal_loan', 'Spoof Bank', 'EUR',
                  500000, 500000, 9.000, 'fixed', 24, '2026-01-01', 22000)`
      )
    ).rejects.toThrow()
  })

  it('A can insert, update and delete its own standalone debt', async () => {
    await asUser(USER_A, async (tx) => {
      const [debt] = await tx`
        insert into public.debts
          (user_id, property_id, type, lender, currency, principal_cents,
           outstanding_cents, interest_rate_pct, rate_type, term_months,
           start_date, payment_cents)
        values (${USER_A}, null, 'credit_card', 'A Card Co', 'EUR', 500000,
                300000, 18.900, 'variable', 36, '2025-03-01', 15000)
        returning id`
      expect(debt?.id).toBeTruthy()

      const updated = await tx`
        update public.debts set outstanding_cents = 250000
        where id = ${debt?.id} returning id`
      expect(updated).toHaveLength(1)

      const deleted = await tx`
        delete from public.debts where id = ${debt?.id} returning id`
      expect(deleted).toHaveLength(1)
    })
  })
})
