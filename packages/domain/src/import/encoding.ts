/**
 * Byte-level encoding resilience for imported files (P2-05).
 *
 * Bank exports arrive as raw bytes in inconsistent encodings: modern systems
 * emit UTF-8 (sometimes BOM-prefixed), but plenty of legacy ES/EU statements
 * are still Latin-1 / windows-1252 (accented merchant names, the `€` sign at
 * byte 0x80). This pure helper turns bytes into a JS string the rest of the
 * import pipeline (delimiter detection → CSV parse → locale parse) can trust.
 *
 * Strategy: an explicit `encoding` hint always wins. Otherwise we strip a
 * UTF-8 BOM and attempt a strict UTF-8 decode; the first invalid sequence
 * means the source isn't UTF-8, so we fall back to windows-1252 (a superset of
 * ISO-8859-1 that also maps the 0x80–0x9F range banks use for `€`, smart
 * quotes, etc.). No I/O.
 */

export type ImportEncoding = 'utf-8' | 'latin1'

export interface DecodeOptions {
  /** Force a specific encoding. Omit (or `'auto'`) to sniff UTF-8 → Latin-1. */
  encoding?: ImportEncoding | 'auto'
}

export interface DecodeResult {
  /** The encoding actually used to produce `text`. */
  encoding: ImportEncoding
  text: string
}

const UTF8_BOM = [0xef, 0xbb, 0xbf]

function stripUtf8Bom(bytes: Uint8Array): Uint8Array {
  if (
    bytes.length >= 3 &&
    bytes[0] === UTF8_BOM[0] &&
    bytes[1] === UTF8_BOM[1] &&
    bytes[2] === UTF8_BOM[2]
  ) {
    return bytes.subarray(3)
  }
  return bytes
}

/**
 * windows-1252 overrides for the 0x80–0x9F range — the only bytes where it
 * diverges from ISO-8859-1 (€, smart quotes, etc.). Bytes outside this range
 * decode by identity (byte value == code point), which is ISO-8859-1. We map
 * this by hand instead of trusting `TextDecoder('windows-1252')`, whose 0x80–
 * 0x9F handling varies across JS-runtime ICU builds. Indexed by `byte - 0x80`.
 */
const WINDOWS_1252_C1: readonly number[] = [
  0x20ac,
  0x0081,
  0x201a,
  0x0192,
  0x201e,
  0x2026,
  0x2020,
  0x2021, // 80–87
  0x02c6,
  0x2030,
  0x0160,
  0x2039,
  0x0152,
  0x008d,
  0x017d,
  0x008f, // 88–8f
  0x0090,
  0x2018,
  0x2019,
  0x201c,
  0x201d,
  0x2022,
  0x2013,
  0x2014, // 90–97
  0x02dc,
  0x2122,
  0x0161,
  0x203a,
  0x0153,
  0x009d,
  0x017e,
  0x0178, // 98–9f
]

function decodeLatin1(bytes: Uint8Array): string {
  let out = ''
  for (const byte of bytes) {
    const code =
      byte >= 0x80 && byte <= 0x9f
        ? (WINDOWS_1252_C1[byte - 0x80] as number)
        : byte
    out += String.fromCharCode(code)
  }
  return out
}

export function decodeBytes(
  bytes: Uint8Array,
  opts: DecodeOptions = {}
): DecodeResult {
  const hint = opts.encoding ?? 'auto'

  if (hint === 'latin1') {
    return { text: decodeLatin1(bytes), encoding: 'latin1' }
  }

  const stripped = stripUtf8Bom(bytes)

  if (hint === 'utf-8') {
    // Non-fatal: replace invalid bytes with U+FFFD rather than throwing.
    return {
      text: new TextDecoder('utf-8').decode(stripped),
      encoding: 'utf-8',
    }
  }

  // auto: prefer a strict UTF-8 decode, fall back to Latin-1 on any bad byte.
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(stripped)
    return { text, encoding: 'utf-8' }
  } catch {
    return { text: decodeLatin1(stripped), encoding: 'latin1' }
  }
}
