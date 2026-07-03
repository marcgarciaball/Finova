/**
 * Export date-range presets (export filters spec, 2026-07-03). Pure: the
 * caller passes "today" so this never reads the clock, keeping it testable
 * against fixed dates. Dates are local-time `YYYY-MM-DD`, matching what the
 * `<input type="date">` controls and the `from`/`to` query params carry.
 */

export const EXPORT_PRESETS = ['all', 'month', 'quarter', 'year'] as const
export type ExportPreset = (typeof EXPORT_PRESETS)[number]

export interface PresetRange {
  from: string | null
  to: string | null
}

const iso = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** The `{from, to}` bounds for a preset, given "today" (local time). */
export function presetRange(preset: ExportPreset, today: Date): PresetRange {
  const to = iso(today)
  switch (preset) {
    case 'all':
      return { from: null, to: null }
    case 'month':
      return {
        from: iso(new Date(today.getFullYear(), today.getMonth(), 1)),
        to,
      }
    case 'quarter':
      // Three calendar months including the current one; Date normalizes
      // negative month indexes across the year boundary.
      return {
        from: iso(new Date(today.getFullYear(), today.getMonth() - 2, 1)),
        to,
      }
    case 'year':
      return { from: iso(new Date(today.getFullYear(), 0, 1)), to }
  }
}
