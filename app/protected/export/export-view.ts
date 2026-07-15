/**
 * Export tab view state (Spec A). The domain the user is exporting, driven by
 * `?domain=`. `everything` is the full multi-domain backup; the others map 1:1
 * to a single `ExportDomain`. Filters only surface for `everything` and
 * `transactions` (they narrow the transactions domain only).
 */

export const EXPORT_VIEWS = [
  'everything',
  'transactions',
  'investments',
  'realEstate',
] as const
export type ExportView = (typeof EXPORT_VIEWS)[number]

export function parseExportView(value: string | undefined): ExportView {
  return (EXPORT_VIEWS as readonly string[]).includes(value ?? '')
    ? (value as ExportView)
    : 'everything'
}

/** Whether the transaction filter bar applies to this view. */
export function viewUsesFilters(view: ExportView): boolean {
  return view === 'everything' || view === 'transactions'
}
