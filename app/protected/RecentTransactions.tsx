import { categoryLabel } from '@finova/domain/categories/label'
import { format, money } from '@finova/domain/money'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { CategoryIcon } from '@/components/dashboard/CategoryIcon'
import { ListRow } from '@/components/dashboard/ListRow'
import { GlassCard } from '@/components/ui/GlassCard'
import type { CategoryRow } from '@/lib/validation/category'
import type { DashboardTxn } from './data'

/**
 * Recent transactions block (P4-04): the newest rows in the selected period,
 * each formatted in its own currency, plus quick links into the full ledger.
 */
export async function RecentTransactions({
  txns,
  categories,
  quickAdd,
}: {
  txns: DashboardTxn[]
  categories: CategoryRow[]
  /** Quick-add trigger rendered next to the title (nav IA priority 2). */
  quickAdd?: React.ReactNode
}) {
  const t = await getTranslations('dashboard.recent')
  const tTypes = await getTranslations('transactions.types')
  const tDefaults = await getTranslations('categories.defaults')
  const locale = await getLocale()

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  })
  const byId = new Map(categories.map((c) => [c.id, c]))

  const labelFor = (categoryId: string | null): string | undefined => {
    if (categoryId === null) return undefined
    const c = byId.get(categoryId)
    return c ? categoryLabel(c, tDefaults) : undefined
  }

  const iconFor = (categoryId: string | null) => {
    const c = categoryId === null ? undefined : byId.get(categoryId)
    return (
      <CategoryIcon
        iconName={c?.icon_name}
        color={c?.color}
        className={c?.color ? undefined : 'text-ink-soft'}
      />
    )
  }

  const quickFilters: { key: string; href: string }[] = [
    { key: 'income', href: '/protected/transactions?type=income' },
    { key: 'expense', href: '/protected/transactions?type=expense' },
    { key: 'transfer', href: '/protected/transactions?type=transfer' },
  ]

  return (
    <GlassCard className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
          {t('title')}
        </h2>
        <div className="flex items-center gap-3">
          {quickAdd}
          <Link
            href="/protected/transactions"
            className="text-brand-600 text-sm hover:underline"
          >
            {t('viewAll')}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {quickFilters.map((f) => (
          <Link
            key={f.key}
            href={f.href}
            className="rounded-full border border-glass-line bg-glass px-3 py-1 text-ink-soft text-xs hover:text-ink"
          >
            {tTypes(f.key)}
          </Link>
        ))}
      </div>

      {txns.length === 0 ? (
        <p className="text-ink-soft text-sm">{t('empty')}</p>
      ) : (
        <div className="flex flex-col">
          {txns.map((tx) => {
            const income = !tx.is_transfer && tx.amount_cents >= 0
            const subtitle = [
              dateFmt.format(new Date(tx.occurred_at)),
              labelFor(tx.category_id),
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <ListRow
                key={tx.id}
                title={tx.description}
                subtitle={subtitle}
                amount={tx.amount_cents}
                income={income}
                icon={iconFor(tx.category_id)}
                format={(n) => format(money(n, tx.currency), locale)}
              />
            )
          })}
        </div>
      )}
    </GlassCard>
  )
}
