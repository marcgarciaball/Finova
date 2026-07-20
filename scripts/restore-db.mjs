// Restore a backup produced by scripts/backup-db.mjs (P5-05). Destructive —
// requires --yes and always restores against DIRECT_URL, never DATABASE_URL.
//
// Run:  node --env-file=.env.local scripts/restore-db.mjs <backup-filename> --yes
// List available backups by omitting the filename.
//
// Requires on PATH: pg_restore. Requires env: DIRECT_URL,
// NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { spawn } from 'node:child_process'
import { rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'db-backups'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`${name} is not set`)
    process.exit(1)
  }
  return value
}

async function runPgRestore(directUrl, dumpFile) {
  await new Promise((resolve, reject) => {
    // --clean --if-exists: drop existing objects first so re-running is
    // idempotent; -1: single transaction, all-or-nothing.
    const restore = spawn(
      'pg_restore',
      ['--dbname', directUrl, '--clean', '--if-exists', '-1', dumpFile],
      { stdio: 'inherit' }
    )
    restore.on('error', reject)
    restore.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`pg_restore exited with code ${code}`))
    )
  })
}

async function main() {
  const [filename, ...flags] = process.argv.slice(2)
  const directUrl = requireEnv('DIRECT_URL')
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  if (!filename) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(undefined, {
        sortBy: { column: 'created_at', order: 'desc' },
      })
    if (error) {
      console.error('list failed:', error.message)
      process.exit(1)
    }
    console.log('available backups:')
    for (const f of data ?? []) {
      console.log(`  ${f.name}  (${f.created_at})`)
    }
    console.log('\nusage: node scripts/restore-db.mjs <filename> --yes')
    return
  }

  if (!flags.includes('--yes')) {
    console.error(
      `this will DROP and restore objects in the database at DIRECT_URL from "${filename}".\n` +
        're-run with --yes to confirm.'
    )
    process.exit(1)
  }

  const { data, error } = await supabase.storage.from(BUCKET).download(filename)
  if (error || !data) {
    console.error('download failed:', error?.message ?? 'not found')
    process.exit(1)
  }

  const tmpFile = path.join(os.tmpdir(), filename)
  await writeFile(tmpFile, Buffer.from(await data.arrayBuffer()))

  console.log(`restoring ${filename}…`)
  await runPgRestore(directUrl, tmpFile)
  await rm(tmpFile, { force: true })
  console.log('restore complete')
}

main().catch((e) => {
  console.error('restore failed:', e.message)
  process.exit(1)
})
