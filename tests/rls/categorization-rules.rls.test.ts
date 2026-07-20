import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * RLS isolation tests for `categorization_rules` (P3-01), mirroring
 * `import-templates.rls.test.ts`.
 *
 * Proves owner isolation (A can't see/mutate B's rules), default-deny, and the
 * `category_id` ON DELETE CASCADE invariant (deleting a category removes its
 * rules — the deliberate difference from `transactions.category_id` SET NULL).
 * Requires a real Postgres — SKIPPED unless TEST_DATABASE_URL points at a
 * disposable database.
 *
 *   TEST_DATABASE_URL="postgresql://...:5432/postgres" npm test -- rls
 */
const url = process.env.TEST_DATABASE_URL
const USER_A = '00000000-0000-0000-0000-00000000000a'
const USER_B = '00000000-0000-0000-0000-00000000000b'
const CONDITIONS = [{ field: 'description', op: 'contains', value: 'lidl' }]

describe.skipIf(!url)('categorization_rules RLS', () => {
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

  let categoryA = ''
  let categoryB = ''

  beforeAll(async () => {
    for (const id of [USER_A, USER_B]) {
      await sql`insert into auth.users (id, email) values (${id}, ${`${id}@test.local`}) on conflict (id) do nothing`
    }
    await sql`delete from public.categorization_rules where user_id in (${USER_A}, ${USER_B})`
    await sql`delete from public.categories where user_id in (${USER_A}, ${USER_B})`
    const [catA] =
      await sql`insert into public.categories (user_id, name, kind) values (${USER_A}, 'Groceries A', 'expense') returning id`
    const [catB] =
      await sql`insert into public.categories (user_id, name, kind) values (${USER_B}, 'Groceries B', 'expense') returning id`
    categoryA = catA?.id as string
    categoryB = catB?.id as string
    await sql`insert into public.categorization_rules (user_id, name, conditions, category_id) values (${USER_A}, 'A rule', ${sql.json(CONDITIONS)}, ${categoryA})`
    await sql`insert into public.categorization_rules (user_id, name, conditions, category_id) values (${USER_B}, 'B rule', ${sql.json(CONDITIONS)}, ${categoryB})`
  })

  afterAll(async () => {
    await sql`delete from auth.users where id in (${USER_A}, ${USER_B})` // cascades
    await sql.end()
  })

  it('A sees only its own rules', async () => {
    const rows = await asUser(
      USER_A,
      (tx) => tx`select user_id from public.categorization_rules`
    )
    expect(rows.map((r) => r.user_id)).toEqual([USER_A])
  })

  it("A cannot read B's rule", async () => {
    const rows = await asUser(
      USER_A,
      (tx) =>
        tx`select id from public.categorization_rules where user_id = ${USER_B}`
    )
    expect(rows).toHaveLength(0)
  })

  it("A cannot update B's rule", async () => {
    const updated = await asUser(
      USER_A,
      (tx) =>
        tx`update public.categorization_rules set name = 'hijacked' where user_id = ${USER_B} returning id`
    )
    expect(updated).toHaveLength(0)
  })

  it("A cannot delete B's rule", async () => {
    const deleted = await asUser(
      USER_A,
      (tx) =>
        tx`delete from public.categorization_rules where user_id = ${USER_B} returning id`
    )
    expect(deleted).toHaveLength(0)
  })

  it('A cannot insert a rule owned by B', async () => {
    await expect(
      asUser(
        USER_A,
        (tx) =>
          tx`insert into public.categorization_rules (user_id, name, conditions, category_id) values (${USER_B}, 'spoof', ${sql.json(CONDITIONS)}, ${categoryB})`
      )
    ).rejects.toThrow()
  })

  it('A can insert and read back its own rule', async () => {
    await asUser(USER_A, async (tx) => {
      const [row] = await tx`
        insert into public.categorization_rules (user_id, name, conditions, category_id)
        values (${USER_A}, 'A second rule', ${sql.json(CONDITIONS)}, ${categoryA})
        returning name, priority, enabled`
      expect(row?.name).toBe('A second rule')
      expect(Number(row?.priority)).toBe(0)
      expect(row?.enabled).toBe(true)
    })
  })

  it('deleting a category cascades to its rules (ON DELETE CASCADE)', async () => {
    // Seed a throwaway category + rule for A, delete the category, the rule is gone.
    const [cat] =
      await sql`insert into public.categories (user_id, name, kind) values (${USER_A}, 'Doomed', 'expense') returning id`
    const catId = cat?.id as string
    await sql`insert into public.categorization_rules (user_id, name, conditions, category_id) values (${USER_A}, 'doomed rule', ${sql.json(CONDITIONS)}, ${catId})`
    await sql`delete from public.categories where id = ${catId}`
    const remaining =
      await sql`select id from public.categorization_rules where category_id = ${catId}`
    expect(remaining).toHaveLength(0)
  })
})
