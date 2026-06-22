export const CAT_SERIES = [
  'var(--cat-blue)',
  'var(--cat-teal)',
  'var(--cat-violet)',
  'var(--cat-amber)',
  'var(--cat-rose)',
  'var(--cat-lime)',
]

export const BRAND_LINE = 'var(--brand-600)'

export function seriesColor(i: number) {
  return CAT_SERIES[i % CAT_SERIES.length]
}
