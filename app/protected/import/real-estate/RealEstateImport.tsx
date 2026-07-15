'use client'

import { Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { GlassCard } from '@/components/ui/GlassCard'
import { Label } from '@/components/ui/Label'
import type {
  RealEstateTable,
  TableCounts,
} from '@/lib/domain/import/backup/plan'
import { commitRealEstateBackup, reviewRealEstateBackup } from './actions'

const TABLES: RealEstateTable[] = [
  'properties',
  'loans',
  'valuations',
  'income',
  'expenses',
]

const KNOWN_ERRORS = new Set([
  'malformed',
  'notFinova',
  'unsupportedVersion',
  'noRealEstate',
  'unexpected',
])

type Phase =
  | { step: 'idle' }
  | { step: 'reviewing' }
  | {
      step: 'reviewed'
      fileText: string
      counts: Record<RealEstateTable, TableCounts>
      totals: TableCounts
    }
  | { step: 'committing'; fileText: string }
  | { step: 'done'; committed: number; skipped: number; errors: number }
  | { step: 'error'; error: string }

/**
 * Real-estate round-trip import (Spec B): drop a Finova JSON backup, review the
 * per-table new/duplicate/error counts the engine computed, then commit. The
 * import is idempotent — re-running is a no-op — so committing twice is safe.
 */
export function RealEstateImport() {
  const t = useTranslations('import.realEstate')
  const [phase, setPhase] = useState<Phase>({ step: 'idle' })

  async function onFile(file: File) {
    setPhase({ step: 'reviewing' })
    const fileText = await file.text()
    const res = await reviewRealEstateBackup({ fileText })
    if (!res.ok) {
      setPhase({ step: 'error', error: res.error })
      return
    }
    setPhase({
      step: 'reviewed',
      fileText,
      counts: res.counts,
      totals: res.totals,
    })
  }

  async function onCommit(fileText: string) {
    setPhase({ step: 'committing', fileText })
    const res = await commitRealEstateBackup({ fileText })
    if (!res.ok) {
      setPhase({ step: 'error', error: res.error })
      return
    }
    setPhase({
      step: 'done',
      committed: res.committed,
      skipped: res.skipped,
      errors: res.errors,
    })
  }

  const busy = phase.step === 'reviewing' || phase.step === 'committing'

  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-soft text-sm">{t('subtitle')}</p>

      <GlassCard className="flex flex-col gap-3">
        <Label htmlFor="re-import-file">{t('dropLabel')}</Label>
        <input
          id="re-import-file"
          type="file"
          accept="application/json,.json"
          disabled={busy}
          className="text-ink text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:font-medium file:text-white hover:file:bg-brand-700"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onFile(file)
          }}
        />
        {phase.step === 'reviewing' ? (
          <p className="text-ink-soft text-sm">{t('reviewing')}</p>
        ) : null}
      </GlassCard>

      {phase.step === 'error' ? (
        <GlassCard className="border-neg/40">
          <p className="text-neg text-sm">
            {t(
              `errors.${KNOWN_ERRORS.has(phase.error) ? phase.error : 'unexpected'}`
            )}
          </p>
        </GlassCard>
      ) : null}

      {phase.step === 'reviewed' || phase.step === 'committing' ? (
        <GlassCard className="flex flex-col gap-4">
          <h3 className="font-semibold">{t('review')}</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink-soft text-xs">
                <th className="py-1 text-left font-medium">{t('table')}</th>
                <th className="py-1 text-right font-medium">{t('cols.new')}</th>
                <th className="py-1 text-right font-medium">
                  {t('cols.duplicate')}
                </th>
                <th className="py-1 text-right font-medium">
                  {t('cols.error')}
                </th>
              </tr>
            </thead>
            <tbody>
              {TABLES.map((tbl) => {
                const c =
                  phase.step === 'reviewed'
                    ? phase.counts[tbl]
                    : { new: 0, duplicate: 0, error: 0 }
                return (
                  <tr key={tbl} className="border-glass-line border-t">
                    <td className="py-1.5">{t(`tables.${tbl}`)}</td>
                    <td className="py-1.5 text-right tabular-nums text-pos">
                      {c.new}
                    </td>
                    <td className="py-1.5 text-right text-ink-soft tabular-nums">
                      {c.duplicate}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {c.error > 0 ? (
                        <span className="text-neg">{c.error}</span>
                      ) : (
                        c.error
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {phase.step === 'reviewed' ? (
            <Button
              type="button"
              className="w-fit"
              disabled={phase.totals.new === 0}
              onClick={() => onCommit(phase.fileText)}
            >
              <Upload aria-hidden="true" />
              {phase.totals.new === 0 ? t('nothingNew') : t('commit')}
            </Button>
          ) : (
            <p className="text-ink-soft text-sm">{t('committing')}</p>
          )}
        </GlassCard>
      ) : null}

      {phase.step === 'done' ? (
        <GlassCard className="border-pos/40">
          <p className="text-sm">
            {t('done', {
              committed: phase.committed,
              skipped: phase.skipped,
            })}
          </p>
        </GlassCard>
      ) : null}
    </div>
  )
}
