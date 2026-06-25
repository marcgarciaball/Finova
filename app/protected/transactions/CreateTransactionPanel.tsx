'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import type { AccountRow } from '@/lib/validation/account'
import type { CategoryRow } from '@/lib/validation/category'
import { TransactionForm } from './TransactionForm'

/** "New transaction" toggle that reveals the create form (page is a server comp). */
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
  const [open, setOpen] = useState(false)

  // Can't record a transaction without an account to put it in.
  if (accounts.length === 0) {
    return <p className="text-ink-soft text-sm">{t('needAccount')}</p>
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        {t('new')}
      </Button>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <TransactionForm
          accounts={accounts}
          categories={categories}
          baseCurrency={baseCurrency}
          todayIso={todayIso}
          onDone={() => setOpen(false)}
        />
      </CardContent>
    </Card>
  )
}
