import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * RLS isolation tests for `categories` (P1-03), mirroring `accounts.rls.test.ts`.
 *
 * Proves a user only sees and mutates their own categories, and that the signup
 * trigger seeds the bilingual default tree. Requires a real Postgres — SKIPPED
 * unless TEST_DATABASE_URL points at a disposable database; never run against
 * production data.
 *
 *   TEST_DATABASE_URL="postgresql://...:5432/postgres" npm test -- rls
 */
const url = process.env.TEST_DATABASE_URL
const USER_A = '00000000-0000-0000-0000-0000000000ca'
const USER_B = '00000000-0000-0000-0000-0000000000cb'

describe.skipIf(!url)('categories RLS', () => {
  const sql = postgres(url as string, { prepare: false })

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
    // Inserting the user fires on_auth_user_created_seed_categories, so the
    // default tree is seeded by the trigger — we don't insert categories here.
    for (const id of [USER_A, USER_B]) {
      await sql`delete from auth.users where id = ${id}`
      await sql`insert into auth.users (id, email) values (${id}, ${`${id}@test.local`})`
    }
  })

  afterAll(async () => {
    await sql`delete from auth.users where id in (${USER_A}, ${USER_B})` // cascades to categories
    await sql.end()
  })

  it('seeds the default tree on signup (parents + subcategories)', async () => {
    const rows = await asUser(
      USER_A,
      (tx) =>
        tx`select name_key, parent_id from public.categories where is_default`
    )
    expect(rows.length).toBeGreaterThanOrEqual(13)
    // groceries/restaurants are subcategories → non-null parent_id.
    const groceries = rows.find((r) => r.name_key === 'groceries')
    expect(groceries?.parent_id).toBeTruthy()
  })

  it('A sees only its own categories', async () => {
    const rows = await asUser(
      USER_A,
      (tx) => tx`select distinct user_id from public.categories`
    )
    expect(rows.map((r) => r.user_id)).toEqual([USER_A])
  })

  it("A cannot read B's categories", async () => {
    const rows = await asUser(
      USER_A,
      (tx) => tx`select id from public.categories where user_id = ${USER_B}`
    )
    expect(rows).toHaveLength(0)
  })

  it("A cannot update B's categories", async () => {
    const updated = await asUser(
      USER_A,
      (tx) =>
        tx`update public.categories set name = 'hijacked' where user_id = ${USER_B} returning id`
    )
    expect(updated).toHaveLength(0)
  })

  it("A cannot delete B's categories", async () => {
    const deleted = await asUser(
      USER_A,
      (tx) =>
        tx`delete from public.categories where user_id = ${USER_B} returning id`
    )
    expect(deleted).toHaveLength(0)
  })

  it('A cannot insert a category owned by B', async () => {
    await expect(
      asUser(
        USER_A,
        (tx) =>
          tx`insert into public.categories (user_id, name, kind) values (${USER_B}, 'spoof', 'expense')`
      )
    ).rejects.toThrow()
  })

  it('A can insert, update and delete its own category', async () => {
    await asUser(USER_A, async (tx) => {
      const [created] = await tx`
        insert into public.categories (user_id, name, kind)
        values (${USER_A}, 'Pets', 'expense') returning id`
      expect(created?.id).toBeTruthy()

      const updated = await tx`
        update public.categories set name = 'Pets (renamed)'
        where id = ${created?.id} returning id`
      expect(updated).toHaveLength(1)

      const deleted = await tx`
        delete from public.categories where id = ${created?.id} returning id`
      expect(deleted).toHaveLength(1)
    })
  })
})
