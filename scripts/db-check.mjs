// Diagnose the Drizzle/Supabase DB connection.
// Run:  node --env-file=.env.local scripts/db-check.mjs
import postgres from 'postgres'

const targets = [
  ['DATABASE_URL (app, expect :6543)', process.env.DATABASE_URL],
  ['DIRECT_URL (migrations, expect :5432)', process.env.DIRECT_URL],
]

for (const [label, url] of targets) {
  console.log(`\n=== ${label} ===`)
  if (!url) {
    console.log('  (not set)')
    continue
  }

  const masked = url.replace(/:\/\/([^:]+):[^@]*@/, '://$1:****@')
  console.log('  value:', masked)

  if (/HOST|YOUR-|\[PASSWORD\]|PASSWORD@/.test(url)) {
    console.log(
      '  ⚠️  STILL A PLACEHOLDER — paste the real string from Supabase → Connect.'
    )
    continue
  }

  let parsed
  try {
    parsed = new URL(url)
    console.log(
      `  parsed: host=${parsed.hostname} port=${parsed.port || '(default)'} user=${parsed.username} db=${parsed.pathname.slice(1)}`
    )
  } catch (e) {
    console.log('  ⚠️  not a valid URL:', e.message)
    continue
  }

  const sql = postgres(url, { prepare: false, connect_timeout: 10 })
  try {
    const rows = await sql`select 1 as ok`
    console.log('  ✅ CONNECT OK', rows[0])
  } catch (e) {
    console.log('  ❌ FAIL:', e.message)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

console.log('')
