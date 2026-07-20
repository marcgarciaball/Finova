// Nightly DB backup (P5-05). Dumps the database with pg_dump, gzips it, and
// uploads it to the private `db-backups` Supabase Storage bucket (migration
// 0020) via the service-role client — no third-party backup service, reuses
// infrastructure the app already depends on. Prunes backups older than 30
// days on every run so the bucket doesn't grow unbounded.
//
// Run:      node --env-file=.env.local scripts/backup-db.mjs
// Restore:  see scripts/restore-db.mjs
//
// Requires on PATH: pg_dump (postgresql-client). Requires env: DIRECT_URL,
// NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { spawn } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const RETENTION_DAYS = 30
const BUCKET = 'db-backups'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`${name} is not set`)
    process.exit(1)
  }
  return value
}

async function runPgDump(directUrl, outFile) {
  await new Promise((resolve, reject) => {
    // --format=custom: compact binary dump, restorable with pg_restore
    // (supports selective/parallel restore, unlike a plain .sql file).
    const dump = spawn(
      'pg_dump',
      [directUrl, '--format=custom', '--file', outFile],
      {
        stdio: 'inherit',
      }
    )
    dump.on('error', reject)
    dump.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`pg_dump exited with code ${code}`))
    )
  })
}

async function pruneOldBackups(supabase) {
  const { data, error } = await supabase.storage.from(BUCKET).list()
  if (error) {
    console.error('list failed (skipping prune):', error.message)
    return
  }
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  const stale = (data ?? [])
    .filter((f) => f.created_at && new Date(f.created_at).getTime() < cutoff)
    .map((f) => f.name)
  if (stale.length === 0) {
    return
  }
  const { error: removeError } = await supabase.storage
    .from(BUCKET)
    .remove(stale)
  if (removeError) {
    console.error('prune failed:', removeError.message)
  } else {
    console.log(
      `pruned ${stale.length} backup(s) older than ${RETENTION_DAYS}d`
    )
  }
}

async function main() {
  const directUrl = requireEnv('DIRECT_URL')
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `backup-${stamp}.dump`
  const tmpFile = path.join(os.tmpdir(), filename)

  console.log('dumping database…')
  await runPgDump(directUrl, tmpFile)

  const bytes = await readFile(tmpFile)
  console.log(`dump size: ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB`)

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, bytes, { contentType: 'application/octet-stream' })
  if (error) {
    console.error('upload failed:', error.message)
    process.exit(1)
  }
  console.log(`uploaded ${filename} to ${BUCKET}`)

  await rm(tmpFile, { force: true })
  await pruneOldBackups(supabase)
}

main().catch((e) => {
  console.error('backup failed:', e.message)
  process.exit(1)
})
