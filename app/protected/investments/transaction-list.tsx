import { getLocale, getTranslations } from 'next-intl/server'
import { GlassCard } from '@/components/ui/GlassCard'
import type { AssetType } from '@/lib/domain/investments/types'
import { format, money } from '@/lib/domain/money'
import type { InvestmentTransactionWithAsset } from './data'
import { TransactionRowActions } from './TransactionRowActions'

/** Chronological buy/sell log (Inversiones A4). Edit/delete arrive in Phase D. */
export async function InvestmentTransactionList({
  transactions,
}: {
  transactions: InvestmentTransactionWithAsset[]
}) {
  const [t, locale] = await Promise.all([
    getTranslations('investments'),
    getLocale(),
  ])
  const todayIso = new Date().toISOString().slice(0, 10)

  if (transactions.length === 0) {
    return (
      <GlassCard>
        <p className="text-ink-soft text-sm">{t('list.empty')}</p>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-ink-soft">
            <th className="py-2 pr-4 font-medium">{t('list.date')}</th>
            <th className="py-2 pr-4 font-medium">{t('list.asset')}</th>
            <th className="py-2 pr-4 font-medium">{t('list.type')}</th>
            <th className="py-2 pr-4 text-right font-medium">
              {t('list.quantity')}
            </th>
            <th className="py-2 pr-4 text-right font-medium">
              {t('list.price')}
            </th>
            <th className="py-2 text-right font-medium">{t('list.fees')}</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn) => (
            <tr key={txn.id} className="border-glass-line border-t">
              <td className="py-2 pr-4 text-ink-soft">{txn.traded_at}</td>
              <td className="py-2 pr-4 text-ink">
                <span className="font-medium">
                  {txn.assets.ticker ?? txn.assets.name}
                </span>
                {txn.assets.ticker ? (
                  <span className="text-ink-soft"> · {txn.assets.name}</span>
                ) : null}
              </td>
              <td className="py-2 pr-4">
                <span className={txn.type === 'buy' ? 'text-pos' : 'text-neg'}>
                  {t(`form.${txn.type}`)}
                </span>
              </td>
              <td className="py-2 pr-4 text-right text-ink">{txn.quantity}</td>
              <td className="py-2 pr-4 text-right text-ink">
                {format(money(txn.price_cents, txn.currency), locale)}
              </td>
              <td className="py-2 text-right text-ink-soft">
                {format(money(txn.fees_cents, txn.currency), locale)}
              </td>
              <td className="py-2 pl-2">
                <TransactionRowActions
                  asset={{
                    currency: txn.currency,
                    id: txn.asset_id,
                    name: txn.assets.name,
                    ticker: txn.assets.ticker ?? '',
                    type: txn.assets.type as AssetType,
                  }}
                  todayIso={todayIso}
                  txn={{
                    currency: txn.currency,
                    fees: (txn.fees_cents / 100).toFixed(2),
                    id: txn.id,
                    notes: txn.notes ?? '',
                    price: (txn.price_cents / 100).toFixed(2),
                    quantity: String(txn.quantity),
                    tradedAt: txn.traded_at,
                    type: txn.type,
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </GlassCard>
  )
}
