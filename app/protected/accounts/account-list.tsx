import { getTranslations } from 'next-intl/server'
import type { AccountRow as Account } from '@/lib/validation/account'
import { AccountRow } from './AccountRow'

/**
 * Presentational (server) list: an Active section, then an Archived section
 * when any archived accounts exist. Empty-state polish is deferred to P4-06.
 */
export async function AccountList({
  accounts,
  baseCurrency,
  balanceById,
}: {
  accounts: Account[]
  baseCurrency: string
  /** Live balance (cents) per account id, from {@link accountBalances}. */
  balanceById: Record<string, number>
}) {
  const t = await getTranslations('accounts')
  const active = accounts.filter((a) => !a.archived)
  const archived = accounts.filter((a) => a.archived)

  if (accounts.length === 0) {
    return <p className="text-ink-soft text-sm">{t('empty')}</p>
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        {active.length === 0 ? (
          <p className="text-ink-soft text-sm">{t('empty')}</p>
        ) : (
          active.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              baseCurrency={baseCurrency}
              balanceCents={balanceById[account.id] ?? account.opening_balance}
            />
          ))
        )}
      </section>

      {archived.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium text-ink-soft text-sm">
            {t('archivedSection')}
          </h2>
          {archived.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              baseCurrency={baseCurrency}
              balanceCents={balanceById[account.id] ?? account.opening_balance}
            />
          ))}
        </section>
      ) : null}
    </div>
  )
}
