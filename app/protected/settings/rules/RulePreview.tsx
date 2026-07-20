'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import {
  buildConditions,
  type ClauseDraft,
} from '@/lib/domain/rules/clause-form'
import { type PreviewResult, previewRule } from './actions'

/**
 * Live "test against your data" panel (P3-06 / P5-01). Debounces the current
 * clause drafts and asks the server how many transactions they'd match.
 */
export function RulePreview({ drafts }: { drafts: ClauseDraft[] }) {
  const t = useTranslations('settings.rules')
  const [result, setResult] = useState<PreviewResult | null>(null)
  const [loading, setLoading] = useState(false)

  // Re-run when the drafts change (serialized so the effect is value-stable).
  const key = JSON.stringify(drafts)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const id = setTimeout(async () => {
      const conditions = buildConditions(JSON.parse(key) as ClauseDraft[])
      const res = await previewRule(conditions)
      if (!cancelled) {
        setResult('error' in res ? null : res)
        setLoading(false)
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [key])

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-glass-line p-3">
      <p className="text-ink-soft text-xs uppercase tracking-wide">
        {t('preview.title')}
      </p>
      {loading && !result ? (
        <p className="text-ink-soft text-sm">{t('preview.loading')}</p>
      ) : result ? (
        <>
          <p className="text-ink text-sm">
            {t('preview.matches', {
              matched: result.matched,
              total: result.total,
            })}
          </p>
          {result.rows.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {result.rows.map((r, i) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: sample rows are positional
                  key={i}
                  className="flex items-center justify-between gap-3 text-ink-soft text-xs"
                >
                  <span className="truncate">{r.description}</span>
                  <span className="shrink-0 tabular-nums">
                    {(r.amountCents / 100).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="text-ink-soft text-sm">{t('preview.none')}</p>
      )}
    </div>
  )
}
