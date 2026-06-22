import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * RLS isolation tests for `transactions` (P1-04), mirroring
 * `accounts.rls.test.ts`.
 *
 * Proves a user can only see and mutate their own transactions, plus the two
 * FK invariants this table introduces: deleting an account that still has
 * transactions is blocked (`restrict`), and deleting a category nulls its
 * transactions' `category_id` (`set null`).
 *
 * Requires a real Postgres — SKIPPED unless TEST_DATABASE_URL points at a
 * disposable database; never run against production data.
 *
 *   TEST_DATABASE_URL="postgresql://...:5432/postgres" npm test -- rls
 */
const url = process.env.TEST_DATABASE_URL
const USER_A = '00000000-0000-0000-0000-00000000000a'
const USER_B = '00000000-0000-0000-0000-00000000000b'

describe.skipIf(!url)('transactions RLS', () => {
  const sql = postgres(url as string, { prepare: false })

  let accountA = ''
  let accountB = ''
  let categoryA = ''

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
    // Seed via the owner connection (bypasses RLS): users, an account each, a
    // category for A, then one transaction each.
    for (const id of [USER_A, USER_B]) {
      await sql`insert into auth.users (id, email) values (${id}, ${`${id}@test.local`}) on conflict (id) do nothing`
    }
    await sql`delete from public.transactions where user_id in (${USER_A}, ${USER_B})`
    await sql`delete from public.categories where user_id in (${USER_A}, ${USER_B})`
    await sql`delete from public.accounts where user_id in (${USER_A}, ${USER_B})`

    const [a] =
      await sql`insert into public.accounts (user_id, name, type, currency) values (${USER_A}, 'A checking', 'checking', 'EUR') returning id`
    const [b] =
      await sql`insert into public.accounts (user_id, name, type, currency) values (${USER_B}, 'B checking', 'checking', 'EUR') returning id`
    accountA = a?.id as string
    accountB = b?.id as string

    const [cat] =
      await sql`insert into public.categories (user_id, name, kind) values (${USER_A}, 'Groceries', 'expense') returning id`
    categoryA = cat?.id as string

    await sql`insert into public.transactions (user_id, account_id, amount_cents, currency, occurred_at, description)
      values (${USER_A}, ${accountA}, -1000, 'EUR', now(), 'A coffee')`
    await sql`insert into public.transactions (user_id, account_id, amount_cents, currency, occurred_at, description)
      values (${USER_B}, ${accountB}, -2000, 'EUR', now(), 'B coffee')`
  })

  afterAll(async () => {
    await sql`delete from auth.users where id in (${USER_A}, ${USER_B})` // cascades to accounts/categories/transactions
    await sql.end()
  })

  it('A sees only its own transactions', async () => {
    const rows = await asUser(
      USER_A,
      (tx) => tx`select user_id from public.transactions`
    )
    expect(rows.map((r) => r.user_id)).toEqual([USER_A])
  })

  it("A cannot read B's transactions even when filtering for them", async () => {
    const rows = await asUser(
      USER_A,
      (tx) => tx`select id from public.transactions where user_id = ${USER_B}`
    )
    expect(rows).toHaveLength(0)
  })

  it("A cannot update B's transaction", async () => {
    const updated = await asUser(
      USER_A,
      (tx) =>
        tx`update public.transactions set description = 'hijacked' where user_id = ${USER_B} returning id`
    )
    expect(updated).toHaveLength(0)
  })

  it("A cannot delete B's transaction", async () => {
    const deleted = await asUser(
      USER_A,
      (tx) =>
        tx`delete from public.transactions where user_id = ${USER_B} returning id`
    )
    expect(deleted).toHaveLength(0)
  })

  it('A cannot insert a transaction owned by B', async () => {
    await expect(
      asUser(
        USER_A,
        (tx) =>
          tx`insert into public.transactions (user_id, account_id, amount_cents, currency, occurred_at, description)
             values (${USER_B}, ${accountB}, -100, 'EUR', now(), 'spoof')`
      )
    ).rejects.toThrow()
  })

  it('A can insert, update and delete its own transaction', async () => {
    await asUser(USER_A, async (tx) => {
      const [created] = await tx`
        insert into public.transactions (user_id, account_id, category_id, amount_cents, currency, occurred_at, description)
        values (${USER_A}, ${accountA}, ${categoryA}, 500, 'EUR', now(), 'A refund') returning id`
      expect(created?.id).toBeTruthy()

      const updated = await tx`
        update public.transactions set description = 'A refund (edited)'
        where id = ${created?.id} returning id`
      expect(updated).toHaveLength(1)

      const deleted = await tx`
        delete from public.transactions where id = ${created?.id} returning id`
      expect(deleted).toHaveLength(1)
    })
  })

  it('blocks deleting an account that still has transactions (FK restrict)', async () => {
    await expect(
      asUser(
        USER_A,
        (tx) => tx`delete from public.accounts where id = ${accountA}`
      )
    ).rejects.toThrow()
  })

  it("nulls a transaction's category when the category is deleted (FK set null)", async () => {
    // Owner connection: delete A's category, then confirm its txns went null.
    const [txn] =
      await sql`insert into public.transactions (user_id, account_id, category_id, amount_cents, currency, occurred_at, description)
        values (${USER_A}, ${accountA}, ${categoryA}, -300, 'EUR', now(), 'categorized') returning id`
    await sql`delete from public.categories where id = ${categoryA}`
    const [after] =
      await sql`select category_id from public.transactions where id = ${txn?.id}`
    expect(after?.category_id).toBeNull()
  })
})
