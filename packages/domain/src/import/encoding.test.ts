// @vitest-environment node
// Runs in Node (not jsdom): this module decodes bytes server-side, and Node's
// TextDecoder implements windows-1252 fully (€ at 0x80) where jsdom's does not.
import { describe, expect, it } from 'vitest'
import { decodeBytes } from './encoding'

const bytes = (...b: number[]) => new Uint8Array(b)

describe('decodeBytes', () => {
  it('decodes plain ASCII as UTF-8', () => {
    const out = decodeBytes(bytes(0x68, 0x69)) // "hi"
    expect(out.text).toBe('hi')
    expect(out.encoding).toBe('utf-8')
  })

  it('decodes valid multi-byte UTF-8', () => {
    // "Café" → é is 0xC3 0xA9 in UTF-8
    const out = decodeBytes(bytes(0x43, 0x61, 0x66, 0xc3, 0xa9))
    expect(out.text).toBe('Café')
    expect(out.encoding).toBe('utf-8')
  })

  it('strips a UTF-8 BOM', () => {
    const out = decodeBytes(bytes(0xef, 0xbb, 0xbf, 0x68, 0x69))
    expect(out.text).toBe('hi')
    expect(out.encoding).toBe('utf-8')
  })

  it('falls back to Latin-1 when bytes are invalid UTF-8', () => {
    // "Café" with é as a lone 0xE9 — invalid as UTF-8, valid Latin-1
    const out = decodeBytes(bytes(0x43, 0x61, 0x66, 0xe9))
    expect(out.text).toBe('Café')
    expect(out.encoding).toBe('latin1')
  })

  it('decodes the windows-1252 euro sign (0x80) under Latin-1 fallback', () => {
    // 0x80 is invalid UTF-8; in windows-1252 it is €
    const out = decodeBytes(bytes(0x80, 0x31, 0x30)) // "€10"
    expect(out.text).toBe('€10')
    expect(out.encoding).toBe('latin1')
  })

  it('honors an explicit latin1 hint even when bytes are valid UTF-8', () => {
    // 0xC3 0xA9 is "é" in UTF-8 but two chars (Ã©) in Latin-1
    const out = decodeBytes(bytes(0xc3, 0xa9), { encoding: 'latin1' })
    expect(out.text).toBe('Ã©')
    expect(out.encoding).toBe('latin1')
  })

  it('honors an explicit utf-8 hint, replacing invalid bytes rather than failing', () => {
    const out = decodeBytes(bytes(0x43, 0x61, 0x66, 0xe9), {
      encoding: 'utf-8',
    })
    expect(out.encoding).toBe('utf-8')
    expect(out.text.startsWith('Caf')).toBe(true)
  })

  it('handles an empty input', () => {
    const out = decodeBytes(bytes())
    expect(out.text).toBe('')
    expect(out.encoding).toBe('utf-8')
  })
})
