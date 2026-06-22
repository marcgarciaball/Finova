import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * RLS isolation tests for `profiles` (P0-08).
 *
 * Proves the security backbone: an authenticated user can only ever see and
 * mutate their own row. Requires a real Postgres (RLS can't be unit-tested in
 * isolation), so the suite is SKIPPED unless TEST_DATABASE_URL points at a
 * disposable database — never run this against production data.
 *
 *   TEST_DATABASE_URL="postgresql://...:5432/postgres" npm test -- rls
 *
 * Mechanism: the owner connection (which bypasses RLS) seeds two rows; queries
 * then run inside a transaction that downgrades to the `authenticated` role and
 * sets the JWT `sub` claim, so `auth.uid()` resolves to the simulated user.
 */
const url = process.env.TEST_DATABASE_URL
const USER_A = '00000000-0000-0000-0000-00000000000a'
const USER_B = '00000000-0000-0000-0000-00000000000b'

describe.skipIf(!url)('profiles RLS', () => {
  const sql = postgres(url as string, { prepare: false })

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
    // Seed via the owner connection (bypasses RLS). Insert auth.users first so
    // the FK holds, then profiles.
    for (const id of [USER_A, USER_B]) {
      await sql`insert into auth.users (id, email) values (${id}, ${`${id}@test.local`}) on conflict (id) do nothing`
      await sql`insert into public.profiles (id) values (${id}) on conflict (id) do nothing`
    }
  })

  afterAll(async () => {
    await sql`delete from auth.users where id in (${USER_A}, ${USER_B})` // cascades to profiles
    await sql.end()
  })

  it('A sees only its own profile row', async () => {
    const rows = await asUser(
      USER_A,
      (tx) => tx`select id from public.profiles`
    )
    expect(rows.map((r) => r.id)).toEqual([USER_A])
  })

  it("A cannot read B's row even when filtering for it", async () => {
    const rows = await asUser(
      USER_A,
      (tx) => tx`select id from public.profiles where id = ${USER_B}`
    )
    expect(rows).toHaveLength(0)
  })

  it("A cannot update B's row", async () => {
    const updated = await asUser(
      USER_A,
      (tx) =>
        tx`update public.profiles set base_currency = 'USD' where id = ${USER_B} returning id`
    )
    expect(updated).toHaveLength(0)
  })

  it('A cannot insert a row owned by B', async () => {
    await expect(
      asUser(
        USER_A,
        (tx) => tx`insert into public.profiles (id) values (${USER_B})`
      )
    ).rejects.toThrow()
  })
})
