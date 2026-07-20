'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import type { AccountRow } from '@/lib/validation/account'
import type { CategoryRow } from '@/lib/validation/category'
import { TransactionForm } from './TransactionForm'
import { TransferForm } from './TransferForm'

type Mode = 'closed' | 'transaction' | 'transfer'

/** "New transaction" / "Transfer" toggle that reveals the create form (page is a server comp). */
export function CreateTransactionPanel({
  accounts,
  categories,
  baseCurrency,
  todayIso,
}: {
  accounts: AccountRow[]
  categories: CategoryRow[]
  baseCurrency: string
  todayIso: string
}) {
  const t = useTranslations('transactions')
  const [mode, setMode] = useState<Mode>('closed')

  // Can't record a transaction without an account to put it in.
  if (accounts.length === 0) {
    return <p className="text-ink-soft text-sm">{t('needAccount')}</p>
  }

  if (mode === 'closed') {
    return (
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => setMode('transaction')}>
          {t('new')}
        </Button>
        {accounts.length >= 2 ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setMode('transfer')}
          >
            {t('transfer.new')}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {mode === 'transfer' ? (
          <TransferForm
            accounts={accounts}
            baseCurrency={baseCurrency}
            todayIso={todayIso}
            onDone={() => setMode('closed')}
          />
        ) : (
          <TransactionForm
            accounts={accounts}
            categories={categories}
            baseCurrency={baseCurrency}
            todayIso={todayIso}
            onDone={() => setMode('closed')}
          />
        )}
      </CardContent>
    </Card>
  )
}
