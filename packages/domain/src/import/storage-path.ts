/**
 * Pure storage-path helpers for the import bucket (P2-01).
 *
 * Objects live under a strict owner prefix `${userId}/${batchId}/${safeName}` so
 * storage RLS (`(storage.foldername(name))[1] = auth.uid()`) can isolate users.
 * These functions never touch I/O — they are exhaustively unit-testable and the
 * Server Action composes them before calling Supabase Storage.
 */

/** Object keys longer than this risk hitting storage limits; the base name is capped. */
const MAX_NAME_LENGTH = 120

/**
 * Sanitize an uploaded filename for use as the final path segment: strips path
 * separators and control characters, replaces other unsafe characters, and caps
 * the length while preserving the extension. Always returns a non-empty string,
 * never a hidden dotfile.
 */
export function safeName(filename: string): string {
  // Drop everything up to the last separator so "../../etc/passwd" → "passwd".
  const base = filename.normalize('NFC').split(/[/\\]/).pop() ?? ''
  const cleaned = base
    // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control chars is the intent
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/[^A-Za-z0-9 ._-]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s-]+/, '') // no leading dots/dashes/space (no hidden files)
    .trim()

  if (cleaned === '') {
    return 'file'
  }

  const dot = cleaned.lastIndexOf('.')
  if (dot <= 0 || dot === cleaned.length - 1) {
    // No usable extension: cap the whole thing.
    return cleaned.slice(0, MAX_NAME_LENGTH)
  }

  const ext = cleaned.slice(dot) // includes the dot
  const stem = cleaned.slice(0, dot)
  const room = Math.max(1, MAX_NAME_LENGTH - ext.length)
  return `${stem.slice(0, room)}${ext}`
}

/** The object key for an upload: `${userId}/${batchId}/${safeName(filename)}`. */
export function buildStoragePath(
  userId: string,
  batchId: string,
  filename: string
): string {
  return `${userId}/${batchId}/${safeName(filename)}`
}

/** True when `path`'s first segment is exactly `userId` (the RLS prefix guard). */
export function isOwnedPath(path: string, userId: string): boolean {
  if (userId === '') {
    return false
  }
  return path.split('/')[0] === userId
}
