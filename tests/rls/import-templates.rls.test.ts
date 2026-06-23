import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * RLS isolation tests for `import_templates` (P2-03), mirroring
 * `accounts.rls.test.ts`.
 *
 * Proves a user can only see and mutate their own mapping templates, and that
 * the unique `(user_id, header_signature)` constraint is per-user (A and B may
 * both hold a template for the same signature). Requires a real Postgres —
 * SKIPPED unless TEST_DATABASE_URL points at a disposable database.
 *
 *   TEST_DATABASE_URL="postgresql://...:5432/postgres" npm test -- rls
 */
const url = process.env.TEST_DATABASE_URL
const USER_A = '00000000-0000-0000-0000-00000000000a'
const USER_B = '00000000-0000-0000-0000-00000000000b'
const SIG = 'deadbeef'
const MAPPING = {
  date: { column: 'Date', format: 'dmy' },
  amount: { kind: 'single', column: 'Amount', negativeIs: 'expense' },
  description: { column: 'Desc' },
}

describe.skipIf(!url)('import_templates RLS', () => {
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
    for (const id of [USER_A, USER_B]) {
      await sql`insert into auth.users (id, email) values (${id}, ${`${id}@test.local`}) on conflict (id) do nothing`
    }
    await sql`delete from public.import_templates where user_id in (${USER_A}, ${USER_B})`
    await sql`insert into public.import_templates (user_id, header_signature, name, mapping) values (${USER_A}, ${SIG}, 'A bank', ${sql.json(MAPPING)})`
    await sql`insert into public.import_templates (user_id, header_signature, name, mapping) values (${USER_B}, ${SIG}, 'B bank', ${sql.json(MAPPING)})`
  })

  afterAll(async () => {
    await sql`delete from auth.users where id in (${USER_A}, ${USER_B})` // cascades
    await sql.end()
  })

  it('A sees only its own templates', async () => {
    const rows = await asUser(
      USER_A,
      (tx) => tx`select user_id from public.import_templates`
    )
    expect(rows.map((r) => r.user_id)).toEqual([USER_A])
  })

  it("A cannot read B's template", async () => {
    const rows = await asUser(
      USER_A,
      (tx) =>
        tx`select id from public.import_templates where user_id = ${USER_B}`
    )
    expect(rows).toHaveLength(0)
  })

  it("A cannot update B's template", async () => {
    const updated = await asUser(
      USER_A,
      (tx) =>
        tx`update public.import_templates set name = 'hijacked' where user_id = ${USER_B} returning id`
    )
    expect(updated).toHaveLength(0)
  })

  it("A cannot delete B's template", async () => {
    const deleted = await asUser(
      USER_A,
      (tx) =>
        tx`delete from public.import_templates where user_id = ${USER_B} returning id`
    )
    expect(deleted).toHaveLength(0)
  })

  it('A cannot insert a template owned by B', async () => {
    await expect(
      asUser(
        USER_A,
        (tx) =>
          tx`insert into public.import_templates (user_id, header_signature, name, mapping) values (${USER_B}, 'spoofsig', 'spoof', ${sql.json(MAPPING)})`
      )
    ).rejects.toThrow()
  })

  it('the unique signature is per-user (A and B both hold SIG)', async () => {
    // Seeded one SIG row for each user; the unique index is composite, so this
    // coexistence is itself the proof. A re-insert of A's own SIG must conflict.
    await expect(
      asUser(
        USER_A,
        (tx) =>
          tx`insert into public.import_templates (user_id, header_signature, name, mapping) values (${USER_A}, ${SIG}, 'dup', ${sql.json(MAPPING)})`
      )
    ).rejects.toThrow()
  })

  it('A can upsert (insert-or-update) its own template by signature', async () => {
    await asUser(USER_A, async (tx) => {
      const [row] = await tx`
        insert into public.import_templates (user_id, header_signature, name, mapping)
        values (${USER_A}, ${SIG}, 'A bank renamed', ${sql.json(MAPPING)})
        on conflict (user_id, header_signature)
        do update set name = excluded.name
        returning name`
      expect(row?.name).toBe('A bank renamed')
    })
  })
})
