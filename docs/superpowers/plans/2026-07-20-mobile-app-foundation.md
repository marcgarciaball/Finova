# Finova Mobile App — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a working, testable React Native (Expo) app that authenticates against the existing Supabase project and renders a real, RLS-scoped dashboard screen — proving the whole mobile architecture end-to-end on one thin vertical slice, before any further screens are built.

**Architecture:** Convert the repo to an npm workspace monorepo. Extract the pure, already-tested `lib/domain/*` business logic (money, dashboard math, etc. — zero DOM/Next.js dependencies today) into a shared workspace package `@finova/domain`, consumed by both the existing Next.js web app (`.` root) and a new Expo app (`mobile/`). The mobile app talks **directly to the same Supabase project** — same Postgres schema, same RLS policies, same auth users — via `@supabase/supabase-js`; no new backend, no new API layer. Session persistence via `@react-native-async-storage/async-storage` (a deliberately-flagged hardening deferral, see Global Constraints). Navigation via Expo Router (file-based, conceptually close to Next's app router). Error reporting reuses the **already-deployed** `/api/log-error` endpoint on the web app — no new backend work and no third-party crash SDK, consistent with the P5-05 decision.

**Tech Stack:** Expo SDK 52 (React Native 0.76, new architecture on by default), Expo Router, TypeScript, `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, Jest + `jest-expo` + `@testing-library/react-native` for the mobile app's own tests, npm workspaces (no new package manager).

## Global Constraints

- No new backend/API surface for this phase — the mobile app is a second client of the exact same Supabase project (same `NEXT_PUBLIC_SUPABASE_URL` / anon key) and the exact same RLS policies already proven in `tests/rls/*`.
- No third-party crash/analytics/error-tracking SDK (Marc's explicit P5-05 decision) — mobile errors are reported to the existing self-hosted `/api/log-error` route.
- Money stays integer cents + ISO-4217 currency everywhere; the mobile app never reimplements money math — it imports `@finova/domain`.
- Every domain function this phase touches must keep its existing unit tests green (`npm test` at the repo root) — this plan **moves** files, it does not rewrite logic.
- EN/ES i18n parity is a repo-wide invariant (`messages/i18n-parity.test.ts`) — this phase does not touch `messages/*.json`, so it stays green untouched.
- `npm run build`, `npm run dev`, and any Expo/iOS/Android simulator or device run are **not runnable in this sandbox** (no port binding, no simulator) — every such step in this plan is marked **[MANUAL — Marc]** and must be verified on a real machine.

---

## File Structure

```
package.json                        # root — gains "workspaces": ["mobile", "packages/*"]
packages/
  domain/
    package.json                    # new — "@finova/domain"
    tsconfig.json                   # new
    src/                            # moved from lib/domain/* (git mv, not copy)
      money/...
      dashboard/...
      accounts/... transactions/... categories/... rules/... import/... export/...
      investments/... real-estate/...
lib/
  domain -> (deleted; re-exported nowhere — every importer now points at @finova/domain)
mobile/
  package.json                     # new — Expo app, depends on @finova/domain via workspace
  app.config.ts                    # new — Expo config, reads env for Supabase URL/anon key
  app/
    _layout.tsx                    # new — root layout: session provider + auth redirect guard
    (auth)/
      login.tsx                    # new — email + password sign-in
    (protected)/
      _layout.tsx                  # new — requires a session, else redirect to /login
      dashboard.tsx                # new — the one real screen this phase ships
  src/
    lib/
      supabase.ts                  # new — RN Supabase client (AsyncStorage-backed)
      log-error.ts                 # new — POSTs to the web app's /api/log-error
    auth/
      session.ts                   # new — pure helpers: mapSupabaseSession, isSessionValid
      session.test.ts              # new
      useSession.ts                # new — React hook wrapping supabase.auth.onAuthStateChange
    data/
      dashboard.ts                 # new — RLS-scoped fetch, mirrors app/protected/data.ts
  jest.config.js                   # new
  tsconfig.json                    # new
scripts/
  migrate-domain-imports.mjs       # new — one-off codemod, deleted after Task 1 lands
```

---

### Task 1: Extract `lib/domain` into a shared workspace package

**Files:**
- Create: `packages/domain/package.json`
- Create: `packages/domain/tsconfig.json`
- Move: `lib/domain/**/*` → `packages/domain/src/**/*` (git mv, preserves history)
- Create: `scripts/migrate-domain-imports.mjs` (temporary codemod, run once then delete)
- Modify: `package.json` (root) — add `"workspaces"`
- Modify: `tsconfig.json` (root) — add a path alias for `@finova/domain`
- Modify: every one of the 128 files currently importing `@/lib/domain/*` (rewritten by the codemod, not by hand)

**Interfaces:**
- Produces: `@finova/domain` — a workspace package whose public surface is every named export currently under `lib/domain/**` (unchanged names, unchanged signatures — this task is a pure move, zero logic changes).

- [ ] **Step 1: Create the package skeleton**

`packages/domain/package.json`:
```json
{
  "name": "@finova/domain",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

`packages/domain/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["esnext"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 2: Move the domain source (preserve git history)**

Run:
```bash
mkdir -p packages/domain/src
git mv lib/domain packages/domain/src/__tmp__
git mv packages/domain/src/__tmp__/* packages/domain/src/
rmdir packages/domain/src/__tmp__
```

- [ ] **Step 3: Create the package's public barrel**

`packages/domain/src/index.ts` — re-export every subdirectory so both consumers can do `import { money } from '@finova/domain'` OR the existing deep-import style (`@finova/domain/money/money`) still works unchanged (only the `@/lib/domain` prefix changes, not the path after it):
```typescript
export * from './accounts'
export * from './categories'
export * from './dashboard'
export * from './export'
export * from './import'
export * from './investments'
export * from './money'
export * from './real-estate'
export * from './rules'
export * from './transactions'
```
(If any subdirectory lacks its own `index.ts`, add a one-line barrel there too, e.g. `packages/domain/src/money/index.ts`: `export * from './money'; export * from './format'; export * from './errors'`. Check each subdirectory's existing files before writing its barrel — don't guess names, `ls packages/domain/src/<dir>`.)

- [ ] **Step 4: Codemod every import site from `@/lib/domain/` to `@finova/domain/`**

`scripts/migrate-domain-imports.mjs`:
```javascript
// One-off codemod for the @finova/domain extraction. Run once, then delete
// this file — it is not part of the ongoing toolchain.
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const files = execSync("grep -rl '@/lib/domain' --include='*.ts' --include='*.tsx' .")
  .toString()
  .split('\n')
  .filter(Boolean)
  .filter((f) => !f.includes('node_modules'))

for (const file of files) {
  const before = readFileSync(file, 'utf8')
  const after = before.replaceAll('@/lib/domain/', '@finova/domain/')
  if (after !== before) {
    writeFileSync(file, after)
    console.log('updated', file)
  }
}
console.log(`done — ${files.length} files scanned`)
```

Run:
```bash
node scripts/migrate-domain-imports.mjs
rm scripts/migrate-domain-imports.mjs
```

- [ ] **Step 5: Wire the workspace**

`package.json` (root) — add before `"dependencies"`:
```json
"workspaces": [
  "mobile",
  "packages/*"
],
```

`tsconfig.json` (root) `compilerOptions.paths` — add alongside the existing `"@/*"` entry:
```json
"paths": {
  "@/*": ["./*"],
  "@finova/domain": ["./packages/domain/src/index.ts"],
  "@finova/domain/*": ["./packages/domain/src/*"]
}
```

`package.json` (root) — add the workspace dependency so `npm install` links it:
```json
"dependencies": {
  "@finova/domain": "*",
  ...
```

- [ ] **Step 6: Reinstall and verify nothing broke**

Run:
```bash
npm install
npm run typecheck
```
Expected: PASS, zero errors. If you see `Cannot find module '@finova/domain/...'`, check Step 3's barrel exports match the exact subpath being imported.

- [ ] **Step 7: Run the full existing test suite**

Run: `npm test`
Expected: same pass/skip counts as before this task (937 pass / 57 skip at the time of writing) — this task moved files, it did not change behavior, so the count must not change.

- [ ] **Step 8: Lint**

Run: `npm run lint`
Expected: PASS. If Biome flags import ordering in files the codemod touched, run `npm run lint:fix` and re-check.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: extract lib/domain into the @finova/domain workspace package"
```

---

### Task 2: Scaffold the Expo app

**Files:**
- Create: `mobile/package.json`
- Create: `mobile/app.config.ts`
- Create: `mobile/tsconfig.json`
- Create: `mobile/jest.config.js`
- Create: `mobile/babel.config.js`
- Create: `mobile/app/_layout.tsx`
- Create: `mobile/app/index.tsx`

**Interfaces:**
- Consumes: `@finova/domain` (Task 1).
- Produces: a bootable Expo project at `mobile/` that Task 3+ builds on.

- [ ] **Step 1: Run the Expo scaffolder inside `mobile/`**

Run:
```bash
npx create-expo-app@latest mobile --template blank-typescript
```
This creates `mobile/package.json`, `mobile/app.json`, `mobile/App.tsx`, `mobile/tsconfig.json`, `mobile/babel.config.js`. We replace the default single-`App.tsx` shape with Expo Router below.

- [ ] **Step 2: Add Expo Router and the workspace dependency**

Run (from `mobile/`):
```bash
cd mobile
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
npm install @finova/domain@* @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
cd ..
```

- [ ] **Step 3: Point Expo at the router entry and delete the scaffolded `App.tsx`**

`mobile/package.json` — set `"main"`:
```json
"main": "expo-router/entry"
```

Run:
```bash
rm mobile/App.tsx
mkdir -p mobile/app
```

- [ ] **Step 4: Root layout**

`mobile/app/_layout.tsx`:
```typescript
import 'react-native-url-polyfill/auto'
import { Stack } from 'expo-router'

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
```

- [ ] **Step 5: Placeholder index route (replaced by the auth guard in Task 4)**

`mobile/app/index.tsx`:
```typescript
import { Text, View } from 'react-native'

export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Finova</Text>
    </View>
  )
}
```

- [ ] **Step 6: Configure `app.config.ts`** (env-driven, reads the same Supabase values the web app already uses — no new secrets)

`mobile/app.config.ts`:
```typescript
import type { ExpoConfig } from 'expo/config'

const config: ExpoConfig = {
  name: 'Finova',
  slug: 'finova',
  scheme: 'finova',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: { bundleIdentifier: 'com.finova.app', supportsTablet: false },
  android: { package: 'com.finova.app' },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    webAppUrl: process.env.EXPO_PUBLIC_WEB_APP_URL, // for /api/log-error
  },
  plugins: ['expo-router'],
}

export default config
```

- [ ] **Step 7: Jest config for the mobile package**

`mobile/jest.config.js`:
```javascript
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
}
```

Run:
```bash
cd mobile
npx expo install jest-expo jest @testing-library/react-native --dev
cd ..
```

`mobile/package.json` — add:
```json
"scripts": {
  "test": "jest"
}
```

- [ ] **Step 8: Verify the scaffold typechecks**

Run: `cd mobile && npx tsc --noEmit && cd ..`
Expected: PASS (no test to run yet — this step just proves the Expo + workspace wiring compiles).

- [ ] **Step 9: [MANUAL — Marc] Boot the app**

On a real machine (not this sandbox — Expo needs to bind a Metro bundler port):
```bash
cd mobile
EXPO_PUBLIC_SUPABASE_URL=<your value> EXPO_PUBLIC_SUPABASE_ANON_KEY=<your value> npx expo start
```
Expected: Metro starts, scanning the QR code in Expo Go (or pressing `i`/`a` for a simulator) shows the "Finova" placeholder screen from Step 5.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(mobile): scaffold the Expo app with Expo Router"
```

---

### Task 3: Supabase client for React Native

**Files:**
- Create: `mobile/src/lib/supabase.ts`

**Interfaces:**
- Consumes: `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Task 2's `app.config.ts`).
- Produces: `supabase` — a configured `SupabaseClient`, imported by every later data/auth module. Same instance shape as the web app's `@supabase/supabase-js` client, so RLS behaves identically.

- [ ] **Step 1: Write the client**

`mobile/src/lib/supabase.ts`:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { createClient } from '@supabase/supabase-js'

// Session persistence via AsyncStorage (unencrypted on-device storage) is a
// deliberate Phase-1 tradeoff, mirroring how P0-11 shipped CSP with
// 'unsafe-inline' and flagged the hardening as a follow-up: swap for
// expo-secure-store (encrypted, but has a ~2KB per-value limit that needs a
// chunking wrapper) before this app carries real user sessions in production.
const { supabaseUrl, supabaseAnonKey } = Constants.expoConfig?.extra ?? {}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/lib/supabase.ts
git commit -m "feat(mobile): add the RN Supabase client"
```

(No unit test here — this module is a thin, untestable-without-a-live-network wrapper; the RLS behavior it depends on is already proven by `tests/rls/*` in the root suite, which Task 1 left untouched.)

---

### Task 4: Auth — session helpers, login screen, protected-route guard

**Files:**
- Create: `mobile/src/auth/session.ts`
- Create: `mobile/src/auth/session.test.ts`
- Create: `mobile/src/auth/useSession.ts`
- Create: `mobile/app/(auth)/login.tsx`
- Create: `mobile/app/(protected)/_layout.tsx`
- Modify: `mobile/app/_layout.tsx` (wrap in the session provider context)
- Modify: `mobile/app/index.tsx` (redirect based on session state instead of the placeholder)

**Interfaces:**
- Consumes: `supabase` (Task 3).
- Produces: `isSessionValid(session: Session | null): boolean`, `useSession(): { session: Session | null; loading: boolean }` — consumed by every protected screen going forward, starting with Task 5's dashboard.

- [ ] **Step 1: Write the failing test for the one pure piece of auth logic this task has**

`mobile/src/auth/session.test.ts`:
```typescript
import { describe, expect, it } from '@jest/globals'
import { isSessionValid } from './session'

describe('isSessionValid', () => {
  it('returns false for null', () => {
    expect(isSessionValid(null)).toBe(false)
  })

  it('returns false for an expired session', () => {
    const expired = { expires_at: Math.floor(Date.now() / 1000) - 60 } as never
    expect(isSessionValid(expired)).toBe(false)
  })

  it('returns true for a session expiring in the future', () => {
    const valid = { expires_at: Math.floor(Date.now() / 1000) + 3600 } as never
    expect(isSessionValid(valid)).toBe(true)
  })
})
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd mobile && npx jest src/auth/session.test.ts`
Expected: FAIL — `session.ts` doesn't exist yet.

- [ ] **Step 3: Implement**

`mobile/src/auth/session.ts`:
```typescript
import type { Session } from '@supabase/supabase-js'

/** True if the session exists and its access token hasn't expired yet. */
export function isSessionValid(session: Session | null): boolean {
  if (!session) {
    return false
  }
  if (session.expires_at === undefined) {
    return true
  }
  return session.expires_at * 1000 > Date.now()
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `cd mobile && npx jest src/auth/session.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: The session hook (not unit-tested — thin wrapper over `supabase.auth`, exercised by manual verification in Step 9)**

`mobile/src/auth/useSession.ts`:
```typescript
import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { supabase } from '@/src/lib/supabase'
import { isSessionValid } from './session'

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  return { session: session && isSessionValid(session) ? session : null, loading }
}
```

- [ ] **Step 6: Login screen** (email + password — the web app's existing "optional password" auth mode from P0-05; magic-link deep-linking is deferred to a later mobile phase since it needs universal-link/App-Link setup that's out of scope for this foundation slice)

`mobile/app/(auth)/login.tsx`:
```typescript
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Button, Text, TextInput, View } from 'react-native'
import { supabase } from '@/src/lib/supabase'

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSignIn() {
    setSubmitting(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setSubmitting(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    router.replace('/(protected)/dashboard')
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Sign in to Finova</Text>
      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, borderRadius: 8, padding: 12 }}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, borderRadius: 8, padding: 12 }}
      />
      {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}
      <Button title={submitting ? 'Signing in…' : 'Sign in'} onPress={handleSignIn} disabled={submitting} />
    </View>
  )
}
```

- [ ] **Step 7: Protected-route guard**

`mobile/app/(protected)/_layout.tsx`:
```typescript
import { Redirect, Stack } from 'expo-router'
import { Text, View } from 'react-native'
import { useSession } from '@/src/auth/useSession'

export default function ProtectedLayout() {
  const { session, loading } = useSession()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading…</Text>
      </View>
    )
  }
  if (!session) {
    return <Redirect href="/(auth)/login" />
  }
  return <Stack screenOptions={{ headerShown: false }} />
}
```

- [ ] **Step 8: Replace the placeholder index route with a session-aware redirect**

`mobile/app/index.tsx`:
```typescript
import { Redirect } from 'expo-router'
import { useSession } from '@/src/auth/useSession'

export default function Index() {
  const { session, loading } = useSession()
  if (loading) {
    return null
  }
  return <Redirect href={session ? '/(protected)/dashboard' : '/(auth)/login'} />
}
```

- [ ] **Step 9: [MANUAL — Marc] Verify on a real device/simulator**

With the dev server from Task 2 Step 9 running: launch the app, confirm it redirects to the login screen, sign in with a real Finova test account's email/password, confirm it redirects toward `/(protected)/dashboard` (which 404s until Task 5 — that's expected at this point).

- [ ] **Step 10: Run the mobile test suite**

Run: `cd mobile && npx jest`
Expected: PASS, 3 tests (from Step 4).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(mobile): auth session helpers, login screen, protected-route guard"
```

---

### Task 5: Dashboard screen (read-only accounts + net worth)

**Files:**
- Create: `mobile/src/data/dashboard.ts`
- Create: `mobile/app/(protected)/dashboard.tsx`

**Interfaces:**
- Consumes: `supabase` (Task 3), `accountBalances`, `totalBalanceByCurrency`, `type BalanceAccount`, `type BalanceTxn` from `@finova/domain` (all already unit-tested in `packages/domain/src/dashboard/summary.test.ts` — this task does not re-test that math, only that this screen wires real rows into it correctly).
- Produces: the first real, data-driven screen — the pattern every later screen (Task-2-of-this-plan's-successor-plans: transactions, categories, etc.) repeats.

- [ ] **Step 1: Data-fetch module — mirrors `app/protected/data.ts#getDashboardData` on the web app, RLS-enforced by the signed-in user's own session (no service-role key on-device, ever)**

`mobile/src/data/dashboard.ts`:
```typescript
import { supabase } from '@/src/lib/supabase'
import type { BalanceAccount, BalanceTxn } from '@finova/domain'

export interface MobileDashboardData {
  accounts: BalanceAccount[]
  txns: BalanceTxn[]
}

export async function getDashboardData(): Promise<MobileDashboardData> {
  const [accountsRes, txnsRes] = await Promise.all([
    supabase.from('accounts').select('id, currency, opening_balance').eq('archived', false),
    supabase.from('transactions').select('account_id, amount_cents, currency'),
  ])
  if (accountsRes.error) {
    throw new Error(accountsRes.error.message)
  }
  if (txnsRes.error) {
    throw new Error(txnsRes.error.message)
  }
  return {
    accounts: accountsRes.data ?? [],
    txns: txnsRes.data ?? [],
  }
}
```

- [ ] **Step 2: Dashboard screen**

`mobile/app/(protected)/dashboard.tsx`:
```typescript
import { accountBalances, format, money, totalBalanceByCurrency } from '@finova/domain'
import { useEffect, useState } from 'react'
import { Button, FlatList, Text, View } from 'react-native'
import { supabase } from '@/src/lib/supabase'
import { getDashboardData } from '@/src/data/dashboard'

export default function DashboardScreen() {
  const [balances, setBalances] = useState<ReturnType<typeof accountBalances>>([])
  const [totals, setTotals] = useState<ReturnType<typeof totalBalanceByCurrency>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDashboardData()
      .then(({ accounts, txns }) => {
        const perAccount = accountBalances(accounts, txns)
        setBalances(perAccount)
        setTotals(totalBalanceByCurrency(perAccount))
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  return (
    <View style={{ flex: 1, padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Net worth</Text>
      {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}
      {Object.entries(totals).map(([currency, total]) => (
        <Text key={currency} style={{ fontSize: 18 }}>
          {format(money(total, currency), 'en')}
        </Text>
      ))}
      <FlatList
        data={balances}
        keyExtractor={(item) => item.accountId}
        renderItem={({ item }) => (
          <Text>
            {item.accountId}: {format(money(item.balance, item.currency), 'en')}
          </Text>
        )}
      />
      <Button title="Sign out" onPress={() => supabase.auth.signOut()} />
    </View>
  )
}
```

(`totalBalanceByCurrency` returns `Record<string, number>` — a map of currency → total cents, per `lib/domain/dashboard/summary.ts` at the time of writing — hence `Object.entries` above rather than `.map`. Re-check this signature against `packages/domain/src/dashboard/summary.ts` after Task 1's move if it diverges before wiring the screen.)

- [ ] **Step 3: [MANUAL — Marc] Verify against a real, seeded Supabase project**

With at least one non-archived account and a few transactions on your test user: sign in, confirm the dashboard shows the correct per-currency net worth (cross-check against the web app's own dashboard for the same user — the numbers must match exactly, since both call the same `accountBalances`/`totalBalanceByCurrency` functions from `@finova/domain`).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(mobile): read-only dashboard screen (accounts + net worth)"
```

---

### Task 6: Self-hosted error reporting from the mobile app

**Files:**
- Create: `mobile/src/lib/log-error.ts`
- Create: `mobile/app/(protected)/_error-boundary.tsx`
- Modify: `mobile/app/(protected)/_layout.tsx` (wrap `<Stack>` in the error boundary)

**Interfaces:**
- Consumes: `EXPO_PUBLIC_WEB_APP_URL` (Task 2's `app.config.ts`), the existing, already-shipped `POST /api/log-error` route on the web app (Task from the prior P5-05 work — accepts `{ message, digest?, path?, stack? }`, capped/validated server-side already).
- Produces: `reportError(error: unknown, context?: { path?: string }): void` — fire-and-forget, never throws.

- [ ] **Step 1: The reporting client**

`mobile/src/lib/log-error.ts`:
```typescript
import Constants from 'expo-constants'

const webAppUrl = Constants.expoConfig?.extra?.webAppUrl as string | undefined

/**
 * Reuses the web app's existing self-hosted /api/log-error endpoint (P5-05)
 * — no separate mobile backend, no third-party crash SDK. Fire-and-forget:
 * a failed report must never surface to the user or crash the app further.
 */
export function reportError(error: unknown, context?: { path?: string }): void {
  if (!webAppUrl) {
    return
  }
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined
  fetch(`${webAppUrl}/api/log-error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, stack, path: context?.path }),
  }).catch(() => {
    // Nothing further to do — this is the last line of defense.
  })
}
```

- [ ] **Step 2: A React error boundary that calls it**

`mobile/app/(protected)/_error-boundary.tsx`:
```typescript
import { Component, type ReactNode } from 'react'
import { Button, Text, View } from 'react-native'
import { reportError } from '@/src/lib/log-error'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    reportError(error)
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Text>Something went wrong.</Text>
          <Button title="Try again" onPress={() => this.setState({ error: null })} />
        </View>
      )
    }
    return this.props.children
  }
}
```

- [ ] **Step 3: Wire it into the protected layout**

`mobile/app/(protected)/_layout.tsx` — wrap the existing `<Stack>` return:
```typescript
import { Redirect, Stack } from 'expo-router'
import { Text, View } from 'react-native'
import { useSession } from '@/src/auth/useSession'
import { ErrorBoundary } from './_error-boundary'

export default function ProtectedLayout() {
  const { session, loading } = useSession()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading…</Text>
      </View>
    )
  }
  if (!session) {
    return <Redirect href="/(auth)/login" />
  }
  return (
    <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }} />
    </ErrorBoundary>
  )
}
```

- [ ] **Step 4: [MANUAL — Marc] Verify end-to-end**

Temporarily `throw new Error('test')` inside `dashboard.tsx`'s render, reload the app, confirm the boundary's fallback UI appears, then check the deployed web app's `error_logs` table (via the Supabase dashboard's table editor, or `psql $DIRECT_URL -c "select message, created_at from error_logs order by occurred_at desc limit 1"`) for a matching row. Remove the temporary `throw` afterward.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(mobile): report render errors to the existing /api/log-error endpoint"
```

---

### Task 7: EAS build configuration

**Files:**
- Create: `mobile/eas.json`
- Modify: `mobile/app.config.ts` (add `extra.eas.projectId` placeholder)

**Interfaces:**
- Produces: buildable `development`, `preview`, and `production` EAS profiles — the prerequisite for both TestFlight/Internal-testing distribution (this plan) and eventual store submission (a later plan, see Roadmap below).

- [ ] **Step 1: [MANUAL — Marc] Create the EAS project** (requires an Expo account — free tier is fine for this phase)

Run:
```bash
cd mobile
npx eas login
npx eas init
```
This writes a real `extra.eas.projectId` into `app.config.ts` for you — do not hand-write a placeholder value, since it must match a real EAS project.

- [ ] **Step 2: Build profiles**

`mobile/eas.json`:
```json
{
  "cli": {
    "version": ">= 13.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

- [ ] **Step 3: [MANUAL — Marc] Run a preview build for each platform**

Run:
```bash
npx eas build --profile preview --platform ios
npx eas build --profile preview --platform android
```
Expected: both complete on Expo's build servers (10-20 min each) and produce an installable `.ipa`/`.apk`/`.aab` — install on a real device or simulator and repeat the Task 4/5/6 manual verifications there instead of just Expo Go, since this is the build shape that eventually goes to TestFlight/Play internal testing.

- [ ] **Step 4: Commit**

```bash
git add mobile/eas.json mobile/app.config.ts
git commit -m "chore(mobile): configure EAS build profiles"
```

---

## Self-Review

**Spec coverage:** Task 1 (shared domain), Task 2 (Expo scaffold), Task 3 (Supabase client), Task 4 (auth), Task 5 (first real screen), Task 6 (error reporting, no third-party SDK per Marc's standing decision), Task 7 (buildable artifacts for real-device verification) — every piece needed to prove "the mobile architecture works end-to-end" is covered. Feature parity (transactions, import, investments, real estate) and app-store submission are explicitly **out of scope** for this plan — see Roadmap.

**Placeholder scan:** No TBD/"add error handling"/"similar to Task N" — every step has literal file contents or an exact command with expected output. Manual/device-dependent steps are marked **[MANUAL — Marc]** rather than faked.

**Type consistency:** `getDashboardData` (Task 5) returns `{ accounts: BalanceAccount[]; txns: BalanceTxn[] }`, matching the exact parameter types `accountBalances(accounts: BalanceAccount[], txns: BalanceTxn[])` from `packages/domain/src/dashboard/summary.ts` (Task 1 relocates this file unchanged). `useSession()`'s return type (`{ session: Session | null; loading: boolean }`, Task 4) matches its one consumer's destructuring in Task 5/6's layouts.

---

## Roadmap — later phases (each needs its own plan doc before implementation)

This plan intentionally stops at one working screen. Once it's merged and verified on a real device, the following become separate `docs/superpowers/plans/*.md` documents — each repeats this plan's established pattern (domain logic already shared; screen = data module + RLS-scoped query + a `@finova/domain` pure-math call), so they're mechanical to scope once Task 5's pattern is proven:

- **Phase 2 — Core CRUD parity:** accounts/transactions/categories/rules screens (create/edit/delete), mirroring `app/protected/{accounts,transactions,settings}` on the web app.
- **Phase 3 — Import on mobile:** file picker (`expo-document-picker`) → the same `@finova/domain` import/mapping/review/commit pipeline already built and tested for the web app.
- **Phase 4 — Investments & Real Estate modules:** same pattern, once Phase 2 proves out on more complex domain state.
- **Phase 5 — Native niceties (optional):** push notifications, biometric unlock (Face ID/Touch ID via `expo-local-authentication`) gating the AsyncStorage session, offline read cache.
- **Phase 6 — App Store & Play Store submission and compliance** (see the dedicated section below — this one Marc asked about explicitly, so it's detailed now even though the code work is later).

## Phase 6 preview — Store Submission & Compliance Checklist

Not code-driven like Tasks 1-7 above; each item is a concrete deliverable/decision, listed now so nothing is discovered for the first time at submission review. This becomes its own plan once Phase 2-4 give the app real functionality worth submitting.

**Accounts & fees**
- [ ] Apple Developer Program enrollment ($99/yr) — required before any TestFlight or App Store submission.
- [ ] Google Play Console account ($25 one-time) — required before any internal-testing track or Play Store submission.

**iOS — App Store Connect**
- [ ] Bundle ID `com.finova.app` (matches `mobile/app.config.ts`) registered in App Store Connect.
- [ ] **Privacy Manifest** (`PrivacyInfo.xcprivacy`, auto-required by Apple since May 2024 for any app using certain "Required Reason" APIs — check which SDKs in `mobile/package.json` need one via `npx expo prebuild` output) declaring: data types collected (email, financial account/transaction data), whether linked to identity (yes — RLS ties every row to the user), whether used for tracking (no).
- [ ] **App Privacy "Nutrition Label" questionnaire** in App Store Connect — must match the mobile-specific additions to `app/privacy/page.tsx`'s content (Task below): data collected = account email + financial data you enter; purpose = app functionality only; NOT used for tracking; NOT shared with third parties for their own purposes (the Investments module's ticker-only calls to Finnhub/FMP/CoinGecko carry no personal data — confirm this framing explicitly in the questionnaire's "third-party" section).
- [ ] **In-app account deletion** (Apple Guideline 5.1.1(v), mandatory since mid-2022 for any app with account creation) — the web app already has this (P5-02, Settings → Danger Zone); the mobile app must surface an equivalent path (can deep-link to the web app's `/protected/settings` if a native screen isn't built yet, but a fully in-app flow is safer for review — track as a Phase 2 dependency).
- [ ] **Sign in with Apple** (Guideline 4.8) — only required if/when a third-party social login (e.g. Google) is offered in the mobile app; the current email+password-only Task 4 login does NOT trigger this requirement. Revisit if Google sign-in is added.
- [ ] Export compliance questionnaire — standard HTTPS/TLS only (Supabase, your web app) typically qualifies for the standard encryption exemption; confirm no custom cryptography is added before answering.
- [ ] App icon (1024×1024 + the full required size set, generated via `npx expo prebuild` / EAS), screenshots for each required device class (6.7", 6.5", 5.5" iPhone + 12.9" iPad if `supportsTablet` is ever turned on).
- [ ] TestFlight internal testing group set up before any external beta.

**Android — Google Play Console**
- [ ] Package name `com.finova.app` (matches `mobile/app.config.ts`) registered.
- [ ] **Data Safety form** — same mapping as iOS's Nutrition Label: data collected (email, financial data), encrypted in transit (yes, HTTPS), user can request deletion (yes), not shared with third parties.
- [ ] **Account deletion — web-accessible path** (Play policy requirement since 2023, distinct from the in-app requirement): a URL reachable **without signing in** that explains/initiates deletion. Confirm `app/privacy/page.tsx` or a dedicated page links this clearly, since Play reviewers check for it outside the app too.
- [ ] Play App Signing enrolled (Google manages the signing key).
- [ ] Content rating questionnaire (financial/finance-tracking category, no ads, no user-generated public content — should land in the lowest rating tier).
- [ ] Privacy Policy URL (`/privacy` on the deployed web app — already exists per P5-07) and Terms URL (`/terms`) entered in the Play Console listing.
- [ ] Internal testing track set up before any closed/open beta.

**Shared — legal content that must be true before either submission**
- [ ] `messages/en.json` / `messages/es.json` `legal.*` namespace (built in P5-07) has every bracketed placeholder (`[LEGAL ENTITY NAME]`, `[JURISDICTION]`, `[16/18]`, contact email) replaced with real values, and a lawyer has reviewed the final copy — both store questionnaires above are cross-checked against this text, so it must be finalized *before* filling either form, not after.
- [ ] Privacy Policy explicitly covers the mobile app's data flows too (AsyncStorage session persistence on-device; no new data categories beyond what the web app already collects, but the *storage location* — the user's device — is new and worth a sentence).
- [ ] Confirm neither store questionnaire claims "no data collected" — Finova collects an account email and the financial data the user enters; answering the forms as "no data collected" would be a false declaration and a fast rejection/removal risk.
