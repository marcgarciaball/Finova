// Verify the P0-07 migration landed.
// Run:  node --env-file=.env.local scripts/db-verify.mjs
import postgres from 'postgres'

const url = process.env.DIRECT_URL
if (!url) {
  console.log('DIRECT_URL not set')
  process.exit(1)
}
const sql = postgres(url, { prepare: false, connect_timeout: 10 })

try {
  const migs =
    await sql`select count(*)::int as n from drizzle.__drizzle_migrations`.catch(
      () => [{ n: '(no drizzle bookkeeping table)' }]
    )
  console.log('drizzle migrations recorded:', migs[0].n)

  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name`
  console.log(
    'public tables:',
    tables.map((t) => t.table_name).join(', ') || '(none)'
  )

  const prof = await sql`
    select c.relrowsecurity as rls from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'profiles'`

  if (!prof.length) {
    console.log('\n❌ profiles: NOT FOUND — migration did not create the table')
  } else {
    console.log('\n✅ profiles: EXISTS — RLS enabled =', prof[0].rls)

    const cols = await sql`
      select column_name, data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
      order by ordinal_position`
    console.log(
      '  columns:',
      cols.map((c) => `${c.column_name}:${c.data_type}`).join(', ')
    )

    const pols = await sql`
      select policyname, cmd from pg_policies
      where schemaname = 'public' and tablename = 'profiles' order by policyname`
    console.log(
      '  policies:',
      pols.map((p) => `${p.policyname}(${p.cmd})`).join(', ') || '(NONE)'
    )

    const trigs = await sql`
      select tgname from pg_trigger
      where tgrelid = 'public.profiles'::regclass and not tgisinternal`
    console.log(
      '  triggers:',
      trigs.map((t) => t.tgname).join(', ') || '(none)'
    )
  }

  const authTrig = await sql`
    select tgname from pg_trigger
    where tgrelid = 'auth.users'::regclass and not tgisinternal
      and tgname = 'on_auth_user_created'`.catch(() => [])
  console.log(
    '\nsignup trigger on auth.users:',
    authTrig.length ? '✅ present' : '❌ MISSING'
  )
} catch (e) {
  console.log('ERROR:', e.message)
} finally {
  await sql.end({ timeout: 5 })
}
console.log('')
