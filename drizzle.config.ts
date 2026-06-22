import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// drizzle-kit is not Next.js, so load env explicitly. Reads .env.local on a
// developer machine; in restricted/CI environments the file may be absent and
// the URL stays empty (fine for `generate`, which never connects).
config({ path: '.env.local' })

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    // Direct (non-pooled) connection for migrations.
    url: process.env.DIRECT_URL ?? '',
  },
  // Supabase manages these schemas; don't let drizzle try to touch them.
  schemaFilter: ['public'],
  verbose: true,
  strict: true,
})
