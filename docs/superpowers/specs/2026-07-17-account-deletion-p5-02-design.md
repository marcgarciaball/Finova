# P5-02 — Account deletion + GDPR export — Design

**Date:** 2026-07-17
**Ticket:** P5-02 (Phase 5 — Hardening & Release)
**Status:** Design approved; implementation pending.

> Outline spec (lean-plans convention): contracts + decisions, not full code.

## Goal

Let a user permanently delete their account and all data (true GDPR erasure),
and make sure they can export everything first. Export already exists (P4-05);
this ticket is almost entirely the **deletion flow** plus a completeness check on
the export bundle.

## Decisions

- **Confirmation:** type-your-own-email (magic-link auth has no password).
  Re-checked server-side; the client gate is UX only.
- **Timing:** immediate hard delete (no grace period / soft-delete).
- **Mechanism:** `admin.auth.admin.deleteUser(sub)` — every user-owned table has
  `user_id → auth.users ON DELETE cascade`, so one call erases all rows. Storage
  is the only non-cascaded surface and is purged explicitly.

## Deletion action — `app/protected/settings/actions.ts#deleteAccount`

Server action, ordered:

1. `requireUser()` → `sub` + `email` from the verified JWT.
2. Validate the submitted confirmation string equals the caller's email
   (`trim`, case-insensitive) via `deleteAccountSchema`. Mismatch → `ActionResult`
   error; nothing is touched.
3. **Purge Storage:** read the caller's `import_batches.storage_path` values
   (RLS-scoped), then `createAdminClient().storage.from('imports').remove(paths)`.
   Enumerating via the table (not recursive storage listing) is precise and
   avoids orphans. Best-effort: a storage error is swallowed/logged, never blocks
   erasure.
4. **Hard delete:** `createAdminClient().auth.admin.deleteUser(sub)` → cascades
   all owned rows across profiles/accounts/transactions/categories/rules/
   import-templates/import-batches/investments/real-estate.
5. `supabase.auth.signOut()` to clear session cookies (ignore errors — the user
   is gone), then `redirect('/goodbye')`.

Owner is always the JWT `sub`; the client sends only the confirmation string.

## UI — Danger zone (bottom of the Profile tab)

`app/protected/settings/DangerZone.tsx` (client), rendered under the Profile
tab's cards in a visually-distinct card:

- Short irreversibility warning.
- **"Download your data first"** link → `/protected/export`.
- Type-your-email `<input>`; the delete button enables only when it matches the
  signed-in email (passed in from the server page). `useActionState`; on success
  the action performs a server-side `redirect`, so no client navigation.

## Goodbye page — `app/goodbye/page.tsx`

Public route confirming deletion, with a link to the landing / sign-in. Added to
the auth-redirect allowlist so a signed-out (now-deleted) user can view it
without being bounced to login.

## Export completeness

Verify `lib/domain/export/bundle.ts` + `app/protected/export/data.ts`
"everything" bundle includes `categories`, `categorization_rules`, and
`import_templates`. Add any missing arrays (the RLS-fetch + schema-parse pattern
already exists for the other domains). This closes the GDPR "right to
portability" side before offering delete.

## Security & tests

- Admin client is `server-only`; email match re-checked server-side; the client
  match is only to gate the button.
- `deleteAccountSchema` unit test: exact match passes; case/whitespace variants
  normalize; a different string fails.
- Cascade correctness is a DB guarantee already covered by the per-table RLS
  suites; the destructive end-to-end path is verified in the browser gate
  (sign up → add data → export → delete → data gone, session ended).

## No migration

Cascades and the storage bucket already exist. Nothing to migrate.
