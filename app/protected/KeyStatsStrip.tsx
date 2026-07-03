import { getLocale, getTranslations } from 'next-intl/server'
import { GlassCard } from '@/components/ui/GlassCard'
import type { KeyStats } from '@/lib/domain/dashboard'
import { format, money } from '@/lib/domain/money'

/**
 * Key-stats strip (UD-08): the headline activity stats — average spend, biggest
 * single expense, busiest day, and transaction count — for the display
 * currency. Values computed upstream (`keyStats`); presentation only.
 */
export async function KeyStatsStrip({
  stats,
  currency,
}: {
  stats: KeyStats
  currency: string
}) {
  const t = await getTranslations('dashboard.keyStats')
  const locale = await getLocale()

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  })
  const fmtMoney = (cents: number) => format(money(cents, currency), locale)

  const cells: { key: string; label: string; value: string; sub?: string }[] = [
    {
      key: 'averageSpend',
      label: t('averageSpend'),
      value: stats.averageSpend === null ? '—' : fmtMoney(stats.averageSpend),
    },
    {
      key: 'biggestExpense',
      label: t('biggestExpense'),
      value: stats.biggestExpense
        ? fmtMoney(stats.biggestExpense.amountCents)
        : '—',
      sub: stats.biggestExpense?.description,
    },
    {
      key: 'busiestDay',
      label: t('busiestDay'),
      value: stats.busiestDay
        ? dateFmt.format(new Date(stats.busiestDay.day))
        : '—',
      sub: stats.busiestDay
        ? t('txnCount', { count: stats.busiestDay.count })
        : undefined,
    },
    {
      key: 'count',
      label: t('count'),
      value: stats.count.toLocaleString(locale),
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4">
      {cells.map((c) => (
        <GlassCard key={c.key} hoverable className="flex flex-col gap-1">
          <span className="font-medium text-ink-soft text-xs uppercase tracking-wide">
            {c.label}
          </span>
          <span className="font-bold font-display text-ink text-xl tabular-nums tracking-tight">
            {c.value}
          </span>
          {c.sub && (
            <span className="truncate text-ink-soft text-xs">{c.sub}</span>
          )}
        </GlassCard>
      ))}
    </div>
  )
}
