'use client'

import { format, money } from '@finova/domain/money'
import { useLocale, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import type { AccountRow as Account } from '@/lib/validation/account'
import { AccountForm } from './AccountForm'
import { deleteAccount, reconcileAccount, setArchived } from './actions'

export function AccountRow({
  account,
  baseCurrency,
  balanceCents,
}: {
  account: Account
  baseCurrency: string
  /** Live balance (opening + signed sum of transactions), in cents. */
  balanceCents: number
}) {
  const t = useTranslations('accounts')
  const locale = useLocale()
  const [editing, setEditing] = useState(false)
  const [reconciling, setReconciling] = useState(false)
  const [targetValue, setTargetValue] = useState('')
  const [pending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)

  if (editing) {
    return (
      <Card>
        <CardContent className="pt-6">
          <AccountForm
            account={account}
            baseCurrency={baseCurrency}
            onDone={() => setEditing(false)}
          />
        </CardContent>
      </Card>
    )
  }

  const balance = format(money(balanceCents, account.currency), locale)
  const opening = format(
    money(account.opening_balance, account.currency),
    locale
  )
  const showOpening = balanceCents !== account.opening_balance
  const balanceMajor = (balanceCents / 100).toFixed(2)

  const openReconcile = () => {
    setActionError(null)
    setTargetValue(balanceMajor)
    setReconciling(true)
  }
  const submitReconcile = () => {
    setActionError(null)
    startTransition(async () => {
      const result = await reconcileAccount(
        account.id,
        targetValue,
        t('reconcile.description')
      )
      if (result.ok) {
        setReconciling(false)
      } else {
        setActionError(t('errors.unexpected'))
      }
    })
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink">{account.name}</span>
            <Badge variant="neutral">{t(`types.${account.type}`)}</Badge>
            {account.archived ? (
              <Badge variant="secondary">{t('archivedLabel')}</Badge>
            ) : null}
          </div>
          <span className="font-semibold text-ink text-sm tabular-nums">
            {balance}
          </span>
          {showOpening ? (
            <span className="text-ink-soft text-xs tabular-nums">
              {t('fields.openingBalance')}: {opening}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => setEditing(true)}
          >
            {t('edit')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending || account.archived}
            onClick={openReconcile}
          >
            {t('reconcile.button')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(() => {
                void setArchived(account.id, !account.archived)
              })
            }
          >
            {account.archived ? t('unarchive') : t('archive')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (window.confirm(t('confirmDelete'))) {
                setActionError(null)
                startTransition(async () => {
                  const result = await deleteAccount(account.id)
                  if (!result.ok) {
                    setActionError(
                      result.error === 'hasTransactions'
                        ? t('errors.hasTransactions')
                        : t('errors.unexpected')
                    )
                  }
                })
              }
            }}
          >
            {t('delete')}
          </Button>
        </div>
        {reconciling ? (
          <div className="flex w-full flex-col gap-2 border-glass-line border-t pt-3">
            <Label htmlFor={`reconcile-${account.id}`}>
              {t('reconcile.label')}
            </Label>
            <p className="text-ink-soft text-xs">{t('reconcile.help')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id={`reconcile-${account.id}`}
                inputMode="decimal"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="w-40"
              />
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={submitReconcile}
              >
                {t('reconcile.submit')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => setReconciling(false)}
              >
                {t('cancel')}
              </Button>
            </div>
          </div>
        ) : null}
        {actionError ? (
          <p className="w-full text-neg text-sm">{actionError}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
