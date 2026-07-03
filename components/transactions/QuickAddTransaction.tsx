'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import {
  type SubmittedTransactionRefs,
  TransactionForm,
} from '@/app/protected/transactions/TransactionForm'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/Dialog'
import type { AccountRow } from '@/lib/validation/account'
import type { CategoryRow } from '@/lib/validation/category'

const LAST_ACCOUNT_KEY = 'finova:lastAccountId'
const LAST_CATEGORY_KEY = 'finova:lastCategoryId'

/**
 * Global "quick add" transaction flow (nav IA priority 2). Wraps the existing
 * `TransactionForm` in a Dialog so it can be triggered from anywhere — the
 * top-bar button, the mobile FAB, or a page-local shortcut — without
 * duplicating the form. Remembers the last-used account/category in
 * localStorage and prefills the next quick-add with them.
 */
export function QuickAddTransaction({
  accounts,
  categories,
  baseCurrency,
  todayIso,
  trigger,
}: {
  accounts: AccountRow[]
  categories: CategoryRow[]
  baseCurrency: string
  todayIso: string
  trigger?: React.ReactNode
}) {
  const t = useTranslations('transactions')
  const [open, setOpen] = useState(false)
  const [lastUsed, setLastUsed] = useState<{
    accountId?: string
    categoryId?: string
  }>({})

  useEffect(() => {
    if (!open) return
    setLastUsed({
      accountId: window.localStorage.getItem(LAST_ACCOUNT_KEY) ?? undefined,
      categoryId: window.localStorage.getItem(LAST_CATEGORY_KEY) ?? undefined,
    })
  }, [open])

  if (accounts.length === 0) {
    return null
  }

  function handleDone(submitted?: SubmittedTransactionRefs) {
    if (submitted) {
      window.localStorage.setItem(LAST_ACCOUNT_KEY, submitted.accountId)
      if (submitted.categoryId) {
        window.localStorage.setItem(LAST_CATEGORY_KEY, submitted.categoryId)
      }
    }
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button">
            <Plus aria-hidden="true" />
            {t('new')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('new')}</DialogTitle>
        </DialogHeader>
        <TransactionForm
          accounts={accounts}
          categories={categories}
          baseCurrency={baseCurrency}
          todayIso={todayIso}
          defaultAccountId={lastUsed.accountId}
          defaultCategoryId={lastUsed.categoryId}
          onDone={handleDone}
        />
      </DialogContent>
    </Dialog>
  )
}
