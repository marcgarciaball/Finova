/**
 * De-duplication for imported transactions (P2-06).
 *
 * Two layers:
 *  - a **deterministic fingerprint** — a stable key over the fields that
 *    identify a transaction (account, date, signed amount, normalized
 *    description). Identical rows across re-imports produce the same
 *    fingerprint, which is what makes the commit idempotent (P2-08).
 *  - a **fuzzy fallback** — flags rows that share a date and amount but whose
 *    descriptions differ only slightly (banks reword the same line between
 *    exports). These are surfaced for human review, never auto-dropped.
 *
 * Pure: no crypto dependency, no I/O. The fingerprint hash is FNV-1a (fast,
 * deterministic, adequate for an idempotency key — not a security hash).
 */

export interface FingerprintInput {
  accountId: string
  amountCents: number
  description: string
  /** The occurrence date; only the `YYYY-MM-DD` portion is significant. */
  occurredAt: string
}

/**
 * Normalize a description for comparison: lowercase, strip accents, drop
 * punctuation, and collapse runs of whitespace. Makes "CAFÉ  Nº1" and
 * "cafe n1" compare equal so trivial reformatting doesn't defeat de-dup.
 */
export function normalizeDescription(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining accent marks
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The canonical, human-readable composite key (before hashing). */
export function fingerprintKey(input: FingerprintInput): string {
  const date = input.occurredAt.slice(0, 10)
  const desc = normalizeDescription(input.description)
  return [input.accountId, date, input.amountCents, desc].join('|')
}

/** FNV-1a 32-bit hash → 8-char hex. Deterministic, non-cryptographic. */
export function fnv1a(str: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    // 32-bit FNV prime multiply, kept in uint32 range.
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * The deterministic fingerprint stored on each imported transaction. Two rows
 * with the same account, date, amount, and normalized description collide by
 * design — that collision is the duplicate signal.
 */
export function transactionFingerprint(input: FingerprintInput): string {
  return fnv1a(fingerprintKey(input))
}

/** Levenshtein edit distance between two strings (iterative, O(n·m) space-light). */
export function levenshtein(a: string, b: string): number {
  if (a === b) {
    return 0
  }
  if (a.length === 0) {
    return b.length
  }
  if (b.length === 0) {
    return a.length
  }

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array<number>(b.length + 1)

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        (curr[j - 1] ?? 0) + 1,
        (prev[j] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost
      )
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length] ?? 0
}

/**
 * Normalized similarity in [0, 1]: 1 = identical, 0 = completely different.
 * `1 - distance / maxLen`, on the normalized descriptions.
 */
export function descriptionSimilarity(a: string, b: string): number {
  const na = normalizeDescription(a)
  const nb = normalizeDescription(b)
  if (na === '' && nb === '') {
    return 1
  }
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) {
    return 1
  }
  return 1 - levenshtein(na, nb) / maxLen
}

export interface FuzzyOptions {
  /** Minimum description similarity (0–1) to treat as a near-duplicate. */
  threshold?: number
}

/**
 * A fuzzy near-duplicate shares the same account, date, and exact signed
 * amount, with a description similar enough to clear `threshold` (default
 * 0.85). Exact duplicates also satisfy this — callers run the deterministic
 * fingerprint first and only fuzzy-check what's left.
 */
export function isFuzzyDuplicate(
  a: FingerprintInput,
  b: FingerprintInput,
  opts: FuzzyOptions = {}
): boolean {
  const threshold = opts.threshold ?? 0.85
  if (a.accountId !== b.accountId) {
    return false
  }
  if (a.occurredAt.slice(0, 10) !== b.occurredAt.slice(0, 10)) {
    return false
  }
  if (a.amountCents !== b.amountCents) {
    return false
  }
  return descriptionSimilarity(a.description, b.description) >= threshold
}
