'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Label } from '@/components/ui/Label'
import type { ColumnMapping } from '@/lib/domain/import/mapping'
import type { AccountRow } from '@/lib/validation/account'
import {
  type CommitActionResult,
  commitBatch,
  type ReviewActionResult,
  reviewBatch,
} from './actions'

const SELECT_CLASS =
  'h-11 rounded-2xl border border-glass-line bg-glass px-4 py-2 text-ink text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

export function ReviewPanel({
  batchId,
  mapping,
  accounts,
}: {
  batchId: string
  mapping: ColumnMapping
  accounts: AccountRow[]
}) {
  const t = useTranslations('import')
  const [accountId, setAccountId] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ReviewActionResult | null>(null)
  const [committing, setCommitting] = useState(false)
  const [commitResult, setCommitResult] = useState<CommitActionResult | null>(
    null
  )

  // A prior review is only valid for the mapping+batch it ran against;
  // invalidate it when either changes so stale counts never linger. The deps
  // are intentional re-run triggers even though the body only clears state.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mapping/batchId are intentional invalidation triggers
  useEffect(() => {
    setResult(null)
    setCommitResult(null)
  }, [mapping, batchId])

  async function onReview() {
    if (!accountId) return
    setRunning(true)
    setCommitResult(null)
    setResult(await reviewBatch({ batchId, accountId, mapping }))
    setRunning(false)
  }

  async function onCommit() {
    setCommitting(true)
    setCommitResult(await commitBatch({ batchId }))
    setCommitting(false)
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <h2 className="font-medium text-ink">{t('review.heading')}</h2>
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="review-account">{t('review.account')}</Label>
            <select
              id="review-account"
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value)
                setResult(null)
                setCommitResult(null)
              }}
              className={SELECT_CLASS}
            >
              <option value="">{t('review.accountPlaceholder')}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            onClick={onReview}
            disabled={running || accountId === ''}
          >
            {running ? t('review.running') : t('review.run')}
          </Button>
        </div>

        {result && !result.ok ? (
          <p className="text-neg text-sm">
            {t(`review.errors.${result.error}` as never)}
          </p>
        ) : null}

        {result?.ok ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-4 text-sm">
              <span className="text-pos">
                {t('review.newCount', { count: result.counts.new })}
              </span>
              <span className="text-ink-soft">
                {t('review.duplicateCount', { count: result.counts.duplicate })}
              </span>
              <span className="text-neg">
                {t('review.errorCount', { count: result.counts.error })}
              </span>
            </div>
            {result.total > result.preview.length ? (
              <p className="text-ink-soft text-xs">
                {t('review.truncated', {
                  shown: result.preview.length,
                  total: result.total,
                })}
              </p>
            ) : null}
            <ul className="flex flex-col gap-1 text-sm">
              {result.preview.map((row) => (
                <li key={row.index} className="flex items-center gap-2">
                  <span className="text-ink-soft text-xs tabular-nums">
                    {row.index}
                  </span>
                  <span>{t(`review.status.${row.status}` as never)}</span>
                  {row.fuzzy ? (
                    <span className="text-ink-soft text-xs">
                      {t('review.fuzzy')}
                    </span>
                  ) : null}
                  {row.txn ? (
                    <span className="text-ink-soft">
                      {row.txn.occurredAt} {row.txn.amountCents}{' '}
                      {row.txn.description}
                    </span>
                  ) : (
                    <span className="text-neg">{row.error?.reason}</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3 border-glass-line border-t pt-3">
              <Button
                type="button"
                onClick={onCommit}
                disabled={committing || result.counts.new === 0}
              >
                {committing ? t('commit.running') : t('commit.run')}
              </Button>
            </div>
            {commitResult && !commitResult.ok ? (
              <p className="text-neg text-sm">
                {t(`commit.errors.${commitResult.error}` as never)}
              </p>
            ) : null}
            {commitResult?.ok ? (
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex gap-4">
                  <span className="text-pos">
                    {t('commit.committed', { count: commitResult.committed })}
                  </span>
                  <span className="text-ink-soft">
                    {t('commit.skipped', { count: commitResult.skipped })}
                  </span>
                  {commitResult.failed > 0 ? (
                    <span className="text-neg">
                      {t('commit.failed', { count: commitResult.failed })}
                    </span>
                  ) : null}
                </div>
                <a
                  href="/protected/transactions"
                  className="text-brand-500 underline"
                >
                  {t('commit.viewTransactions')}
                </a>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
