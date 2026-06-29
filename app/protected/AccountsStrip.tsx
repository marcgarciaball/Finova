import { getLocale, getTranslations } from 'next-intl/server'
import { GlassCard } from '@/components/ui/GlassCard'
import type { AccountBalance } from '@/lib/domain/dashboard'
import { format, money } from '@/lib/domain/money'
import type { AccountRow } from '@/lib/validation/account'

/**
 * Accounts strip (UD-02): every account side by side with its live balance,
 * plus total net worth per currency. The "all your accounts and balances at a
 * glance" panel — the first thing the unified dashboard answers. Balances are
 * computed upstream (`accountBalances`); this is presentation only.
 */
export async function AccountsStrip({
  accounts,
  balances,
  netWorthByCurrency,
}: {
  accounts: AccountRow[]
  balances: AccountBalance[]
  netWorthByCurrency: Record<string, number>
}) {
  const t = await getTranslations('dashboard.accountsStrip')
  const tTypes = await getTranslations('accounts.types')
  const locale = await getLocale()

  const byId = new Map(accounts.map((a) => [a.id, a]))
  const netWorthEntries = Object.entries(netWorthByCurrency).sort((a, b) =>
    a[0].localeCompare(b[0])
  )

  return (
    <GlassCard className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
          {t('title')}
        </h2>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-ink-soft text-xs uppercase tracking-wide">
            {t('netWorth')}
          </span>
          {netWorthEntries.map(([currency, total]) => (
            <span
              key={currency}
              className="font-display font-semibold text-ink text-lg tabular-nums"
            >
              {format(money(total, currency), locale)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {balances.map((b) => {
          const account = byId.get(b.accountId)
          return (
            <div
              key={b.accountId}
              className="flex flex-col gap-1 rounded-2xl border border-glass-line bg-glass p-3"
            >
              <span className="truncate font-medium text-ink text-sm">
                {account?.name ?? b.accountId}
              </span>
              <span className="text-ink-soft text-xs">
                {account ? tTypes(account.type) : ''}
              </span>
              <span className="font-semibold text-ink tabular-nums">
                {format(money(b.balance, b.currency), locale)}
              </span>
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}
