import { getLocale, getTranslations } from 'next-intl/server'
import { GlassCard } from '@/components/ui/GlassCard'
import type { AccountBalance } from '@/lib/domain/dashboard'
import { format, money } from '@/lib/domain/money'
import { cn } from '@/lib/utils'
import type { AccountRow } from '@/lib/validation/account'

/**
 * Accounts strip (UD-02): every account side by side with its live balance —
 * the "all your accounts and balances at a glance" panel. Net worth now lives
 * once, in `CurrencyBreakdown` + the hero card, so it isn't repeated here too.
 * Balances are computed upstream (`accountBalances`); this is presentation only.
 */
export async function AccountsStrip({
  accounts,
  balances,
  className,
}: {
  accounts: AccountRow[]
  balances: AccountBalance[]
  className?: string
}) {
  const t = await getTranslations('dashboard.accountsStrip')
  const tTypes = await getTranslations('accounts.types')
  const locale = await getLocale()

  const byId = new Map(accounts.map((a) => [a.id, a]))

  return (
    <GlassCard className={cn('flex flex-col gap-4', className)}>
      <h2 className="font-medium text-ink-soft text-xs uppercase tracking-wide">
        {t('title')}
      </h2>

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
