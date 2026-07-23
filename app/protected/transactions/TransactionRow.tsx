'use client'

import { categoryLabel } from '@finova/domain/categories/label'
import { format, money } from '@finova/domain/money'
import { transactionType } from '@finova/domain/transactions/filters'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import type { AccountRow } from '@/lib/validation/account'
import type { CategoryRow } from '@/lib/validation/category'
import type { TransactionRow as Transaction } from '@/lib/validation/transaction'
import {
  deleteTransaction,
  duplicateTransaction,
  recategorizeTransaction,
} from './actions'
import { useSelection } from './SelectionContext'
import { TransactionForm } from './TransactionForm'

const SELECT_CLASS =
  'h-9 rounded-xl border border-glass-line bg-glass px-2 text-ink text-xs shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

export function TransactionRow({
  transaction,
  accounts,
  categories,
  baseCurrency,
  todayIso,
}: {
  transaction: Transaction
  accounts: AccountRow[]
  categories: CategoryRow[]
  baseCurrency: string
  todayIso: string
}) {
  const t = useTranslations('transactions')
  const tCat = useTranslations('categories.defaults')
  const locale = useLocale()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [recategorizeError, setRecategorizeError] = useState(false)
  const { active, isSelected, toggle } = useSelection()

  if (editing) {
    return (
      <Card>
        <CardContent className="pt-6">
          <TransactionForm
            transaction={transaction}
            accounts={accounts}
            categories={categories}
            baseCurrency={baseCurrency}
            todayIso={todayIso}
            onDone={() => setEditing(false)}
          />
        </CardContent>
      </Card>
    )
  }

  const type = transactionType(transaction)
  const amount = format(
    money(transaction.amount_cents, transaction.currency),
    locale
  )
  const account = accounts.find((a) => a.id === transaction.account_id)
  const dateLabel = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
  }).format(new Date(transaction.occurred_at))

  const amountTone =
    type === 'transfer'
      ? 'text-ink-soft'
      : transaction.amount_cents < 0
        ? 'text-neg'
        : 'text-pos'

  return (
    <Card>
      <CardContent className="flex flex-nowrap items-center justify-between gap-3 pt-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {active ? (
            <Checkbox
              checked={isSelected(transaction.id)}
              onCheckedChange={() => toggle(transaction.id)}
              aria-label={t('selection.selectRow')}
            />
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-semibold text-ink">
                {transaction.description}
              </span>
              {type === 'transfer' ? (
                <Badge variant="neutral">{t('types.transfer')}</Badge>
              ) : null}
              {transaction.is_recurring ? (
                <Badge variant="secondary">{t('recurringLabel')}</Badge>
              ) : null}
            </div>
            <div className="flex min-w-0 items-center gap-2 truncate text-ink-soft text-xs">
              <span className="shrink-0">{dateLabel}</span>
              {account ? (
                <>
                  <span aria-hidden className="shrink-0">
                    ·
                  </span>
                  <span className="truncate">{account.name}</span>
                </>
              ) : null}
              {transaction.tags.length > 0 ? (
                <>
                  <span aria-hidden className="shrink-0">
                    ·
                  </span>
                  <span className="truncate">
                    {transaction.tags.map((tag) => `#${tag}`).join(' ')}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className={`font-semibold text-sm tabular-nums ${amountTone}`}>
            {amount}
          </span>

          {active ? null : (
            <>
              {/* Inline recategorize — blank option un-categorizes the row. */}
              <div className="flex flex-col gap-1">
                <select
                  aria-label={t('fields.category')}
                  className={SELECT_CLASS}
                  disabled={pending}
                  value={transaction.category_id ?? ''}
                  onChange={(e) => {
                    const next = e.target.value === '' ? null : e.target.value
                    setRecategorizeError(false)
                    startTransition(async () => {
                      const result = await recategorizeTransaction(
                        transaction.id,
                        next
                      )
                      if (!result.ok) {
                        setRecategorizeError(true)
                      }
                    })
                  }}
                >
                  <option value="">{t('uncategorized')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {categoryLabel(c, tCat)}
                    </option>
                  ))}
                </select>
                {recategorizeError ? (
                  <p className="text-neg text-xs">{t('errors.unexpected')}</p>
                ) : null}
              </div>

              {/* Turn a categorized row into a rule (P3-05): deep-link the rules
                  editor prefilled from this row's description + category. */}
              {transaction.category_id ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    router.push(
                      `/protected/settings/rules?description=${encodeURIComponent(
                        transaction.description
                      )}&categoryId=${transaction.category_id}`
                    )
                  }
                >
                  {t('makeRule')}
                </Button>
              ) : null}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => setEditing(true)}
              >
                {t('edit')}
              </Button>
              {/* Duplicate (roadmap 1.2) — same purchase again, dated today. Not
                  offered on transfer legs (a copy would be an unpaired transfer). */}
              {type !== 'transfer' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(() => {
                      void duplicateTransaction(transaction.id)
                    })
                  }
                >
                  {t('duplicate')}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={() => {
                  if (window.confirm(t('confirmDelete'))) {
                    startTransition(() => {
                      void deleteTransaction(transaction.id)
                    })
                  }
                }}
              >
                {t('delete')}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
