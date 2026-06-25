'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { format, money } from '@/lib/domain/money'
import type { AccountRow as Account } from '@/lib/validation/account'
import { AccountForm } from './AccountForm'
import { deleteAccount, setArchived } from './actions'

export function AccountRow({
  account,
  baseCurrency,
}: {
  account: Account
  baseCurrency: string
}) {
  const t = useTranslations('accounts')
  const locale = useLocale()
  const [editing, setEditing] = useState(false)
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

  const balance = format(
    money(account.opening_balance, account.currency),
    locale
  )

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
          <span className="text-ink-soft text-sm tabular-nums">{balance}</span>
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
        {actionError ? (
          <p className="w-full text-neg text-sm">{actionError}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
