import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * RLS isolation tests for `import_batches` (P2-01), mirroring
 * `accounts.rls.test.ts`.
 *
 * Proves a user can only see and mutate their own import batches. Requires a real
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
const USER_A = '00000000-0000-0000-0000-00000000000a'
const USER_B = '00000000-0000-0000-0000-00000000000b'

describe.skipIf(!url)('import_batches RLS', () => {
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
    // Seed via the owner connection (bypasses RLS). auth.users first (FK), then
    // one batch each for A and B.
    for (const id of [USER_A, USER_B]) {
      await sql`insert into auth.users (id, email) values (${id}, ${`${id}@test.local`}) on conflict (id) do nothing`
    }
    await sql`delete from public.import_batches where user_id in (${USER_A}, ${USER_B})`
    await sql`insert into public.import_batches (user_id, storage_path) values (${USER_A}, ${`${USER_A}/a/a.csv`})`
    await sql`insert into public.import_batches (user_id, storage_path) values (${USER_B}, ${`${USER_B}/b/b.csv`})`
  })

  afterAll(async () => {
    await sql`delete from auth.users where id in (${USER_A}, ${USER_B})` // cascades to import_batches
    await sql.end()
  })

  it('A sees only its own batches', async () => {
    const rows = await asUser(
      USER_A,
      (tx) => tx`select user_id from public.import_batches`
    )
    expect(rows.map((r) => r.user_id)).toEqual([USER_A])
  })

  it("A cannot read B's batch even when filtering for it", async () => {
    const rows = await asUser(
      USER_A,
      (tx) => tx`select id from public.import_batches where user_id = ${USER_B}`
    )
    expect(rows).toHaveLength(0)
  })

  it("A cannot update B's batch", async () => {
    const updated = await asUser(
      USER_A,
      (tx) =>
        tx`update public.import_batches set status = 'failed' where user_id = ${USER_B} returning id`
    )
    expect(updated).toHaveLength(0)
  })

  it("A cannot delete B's batch", async () => {
    const deleted = await asUser(
      USER_A,
      (tx) =>
        tx`delete from public.import_batches where user_id = ${USER_B} returning id`
    )
    expect(deleted).toHaveLength(0)
  })

  it('A cannot insert a batch owned by B', async () => {
    await expect(
      asUser(
        USER_A,
        (tx) =>
          tx`insert into public.import_batches (user_id, storage_path) values (${USER_B}, ${`${USER_B}/spoof/x.csv`})`
      )
    ).rejects.toThrow()
  })

  it('A can insert, update and delete its own batch', async () => {
    await asUser(USER_A, async (tx) => {
      const [created] = await tx`
        insert into public.import_batches (user_id, storage_path)
        values (${USER_A}, ${`${USER_A}/new/n.csv`}) returning id`
      expect(created?.id).toBeTruthy()

      const updated = await tx`
        update public.import_batches set status = 'mapped'
        where id = ${created?.id} returning id`
      expect(updated).toHaveLength(1)

      const deleted = await tx`
        delete from public.import_batches where id = ${created?.id} returning id`
      expect(deleted).toHaveLength(1)
    })
  })
})
