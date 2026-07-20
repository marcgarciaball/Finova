'use client'

import { applyMapping, type ColumnMapping } from '@finova/domain/import/mapping'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { Badge } from '@/components/ui/Badge'

/** Format signed integer cents as a plain 2-decimal string for the preview. */
function fmtCents(cents: number): string {
  return (cents / 100).toFixed(2)
}

/**
 * Live preview of the sample rows under the current mapping (P2-03). Runs the
 * pure {@link applyMapping} engine client-side — no I/O — and shows mapped rows
 * plus a per-row error count. Nothing is committed; this is the boundary the
 * P2-07 review screen will pick up.
 */
export function MappingPreview({
  sampleRecords,
  mapping,
}: {
  sampleRecords: Record<string, string>[]
  mapping: ColumnMapping
}) {
  const t = useTranslations('import')
  const { rows, errors } = useMemo(
    () => applyMapping(sampleRecords, mapping),
    [sampleRecords, mapping]
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-sm">{t('preview.title')}</h3>
        <Badge>{t('preview.okCount', { count: rows.length })}</Badge>
        {errors.length > 0 ? (
          <Badge variant="neg">
            {t('preview.errorCount', { count: errors.length })}
          </Badge>
        ) : null}
      </div>

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-glass-line">
          <table className="w-full text-left text-sm">
            <thead className="text-ink-soft">
              <tr>
                <th className="px-3 py-2">{t('preview.date')}</th>
                <th className="px-3 py-2">{t('preview.amount')}</th>
                <th className="px-3 py-2">{t('preview.description')}</th>
                <th className="px-3 py-2">{t('preview.currency')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.occurredAt}|${r.amountCents}|${r.description}`}
                  className="border-glass-line border-t"
                >
                  <td className="px-3 py-2">{r.occurredAt}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {fmtCents(r.amountCents)}
                  </td>
                  <td className="px-3 py-2">{r.description}</td>
                  <td className="px-3 py-2 text-ink-soft">
                    {r.currency ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-ink-soft text-sm">{t('preview.empty')}</p>
      )}

      {errors.length > 0 ? (
        <ul className="flex flex-col gap-1 text-neg text-xs">
          {errors.slice(0, 5).map((e) => (
            <li key={`${e.rowIndex}-${e.field}`}>
              {t('preview.rowError', {
                row: e.rowIndex + 1,
                field: e.field,
                reason: e.reason,
              })}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
