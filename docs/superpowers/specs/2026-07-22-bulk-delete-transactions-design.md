# Bulk Delete Transactions — Design

## Problem

Transactions can only be deleted one at a time (`deleteTransaction`, confirmed via `window.confirm`). There is no way to remove many transactions at once — e.g. all transactions in a category, in a date range, or an arbitrary multi-select — without deleting them individually.

## Goals

- Select transactions via checkboxes, including "select all matching the current filter" across all pages, not just the loaded page.
- Delete the selection in one action, with a single confirmation showing the exact count.
- No soft-delete/undo — matches the friction level of other destructive actions in the app today.

## Non-goals

- Soft-delete / trash / undo window.
- Bulk edit or bulk recategorize (only delete, in this spec).
- Persisting selection across page reloads or filter changes.

## UI

- Each `TransactionRow` gets an always-visible checkbox on the left of the card (there is unused space there today — see current screenshot: description/date on the left, category + actions cluster on the right).
- A header checkbox above the list is tri-state (unchecked / checked / indeterminate for partial-page selection).
- Checking the header checkbox when the filtered set extends beyond the current page shows an inline prompt: *"342 transactions match this filter — [Select all 342] / [Just these N]"*.
- A floating bulk-action bar appears once ≥1 row is selected: "N selected", a destructive "Delete" button, and "Clear selection".
- Selection state resets on page navigation or filter changes (no cross-context persistence).

## Selection state model

One of three modes, held in a client-side `SelectionProvider` (React Context) wrapping `TransactionList`:

- `none`
- `{ mode: 'ids', ids: Set<string> }` — explicit picks, or "select all on this page".
- `{ mode: 'all-filtered', excludedIds: Set<string> }` — "select all matching filter"; unchecking an individual row afterward adds it to `excludedIds` rather than materializing the full id set client-side.

`TransactionList` stays a server component; `TransactionRow` (already `'use client'`) reads/writes the context. The bulk-action bar is a new client component sibling to the list.

## Confirmation

- Uses the existing `Dialog` component (first real destructive-action usage of it, replacing the ad hoc `window.confirm` pattern used by single delete).
- Content: "Delete N transactions? This can't be undone." with Cancel / Delete (destructive style, matching existing row-level Delete buttons).
- Count for `ids` mode is `ids.size`. Count for `all-filtered` mode reuses the existing filtered-count query (same one backing pagination/totals), minus `excludedIds.size`.
- Single click confirms — no typed confirmation, no undo.

## Server action

New `bulkDeleteTransactions` in `app/protected/transactions/actions.ts`, alongside the existing `deleteTransaction`:

```
type BulkDeleteInput =
  | { mode: 'ids'; ids: string[] }
  | { mode: 'filtered'; filters: TransactionFilters; excludeIds: string[] }
```

- `ids` mode: `.delete().in('id', ids)`, scoped to the authenticated user.
- `filtered` mode: reuse `applyFilters` on the delete query, add `.not('id', 'in', excludeIds)` when `excludeIds` is non-empty, scoped to the authenticated user.
- Both call `revalidatePath` afterward, matching the existing single-delete action.

## Error handling

- Try/catch in the server action, returning `{ error }` on failure for a toast — same convention as other actions in `actions.ts`.
- No partial-failure handling needed: each mode is a single SQL delete, not a per-row loop.

## Testing

- Unit tests for the selection-state reducer: toggling individual ids, page-level select-all, filter-level select-all, and exclusion tracking in `all-filtered` mode.
- Server-action tests for `bulkDeleteTransactions` covering both `ids` and `filtered` (with and without exclusions) modes, following the existing test patterns for `actions.ts`.
