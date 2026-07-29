import type { AssetType } from '@finova/domain/investments/types'
import { format, money } from '@finova/domain/money'
import { getLocale, getTranslations } from 'next-intl/server'
import { GlassCard } from '@/components/ui/GlassCard'
import type { InvestmentTransactionWithAsset } from './data'
import { TransactionsTable } from './TransactionsTable'

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
      <TransactionsTable
        rows={transactions.map((txn) => ({
          assetId: txn.asset_id,
          assetType: txn.assets.type as AssetType,
          currency: txn.currency,
          fees: (txn.fees_cents / 100).toFixed(2),
          feesCents: txn.fees_cents,
          feesDisplay: format(money(txn.fees_cents, txn.currency), locale),
          fundingNote: txn.funding_note ?? '',
          fundingSource: txn.funding_source,
          id: txn.id,
          name: txn.assets.name,
          notes: txn.notes ?? '',
          price: (txn.price_cents / 100).toFixed(2),
          priceCents: txn.price_cents,
          priceDisplay: format(money(txn.price_cents, txn.currency), locale),
          quantity: txn.quantity,
          ticker: txn.assets.ticker ?? '',
          tradedAt: txn.traded_at,
          type: txn.type,
          typeLabel: t(`form.${txn.type}`),
        }))}
        labels={{
          asset: t('list.asset'),
          credit: t('list.credit'),
          date: t('list.date'),
          fees: t('list.fees'),
          price: t('list.price'),
          quantity: t('list.quantity'),
          type: t('list.type'),
        }}
        todayIso={todayIso}
      />
    </GlassCard>
  )
}
