import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/auth/require-user'
import { refreshPrices } from '@/lib/investments/jobs/refresh-prices'
import { AddTransactionPanel } from './AddTransactionPanel'
import { addInvestmentTransaction, resolveAsset, searchAssets } from './actions'
import { getOrCreatePortfolio, listInvestmentTransactions } from './data'
import { InvestmentsOverviewSection } from './InvestmentsOverview'
import { getInvestmentsOverview } from './overview-data'
import { InvestmentTransactionList } from './transaction-list'

/**
 * Inversiones (P-investments, slice A4): manual portfolio tracker. This
 * slice ships asset search + the buy/sell log; holdings, KPIs and charts
 * arrive with Phase B once the refresh job (A5) fills cached_quotes.
 */
export default async function InvestmentsPage() {
  await requireUser()
  await getOrCreatePortfolio() // first-visit bootstrap
  const [t, transactions] = await Promise.all([
    getTranslations('investments'),
    listInvestmentTransactions(),
  ])
  let overview = await getInvestmentsOverview()

  // Prices should just be there: refresh inline when quotes are missing or
  // older than 30 minutes, then recompute. Failures fall back to whatever is
  // cached — the page never breaks on a provider outage.
  const STALE_MS = 30 * 60 * 1000
  const stale =
    overview.hasTransactions &&
    (overview.unpricedCount > 0 ||
      !overview.latestFetchedAt ||
      Date.now() - new Date(overview.latestFetchedAt).getTime() > STALE_MS)
  if (stale) {
    try {
      await refreshPrices()
      overview = await getInvestmentsOverview()
    } catch (e) {
      console.error('inline price refresh failed:', e)
    }
  }
  const todayIso = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-bold text-2xl">{t('title')}</h1>
        <p className="text-ink-soft text-sm">{t('subtitle')}</p>
      </div>

      <InvestmentsOverviewSection overview={overview} />

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-lg">{t('addTitle')}</h2>
        <AddTransactionPanel
          addAction={addInvestmentTransaction}
          resolveAction={resolveAsset}
          searchAction={searchAssets}
          todayIso={todayIso}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-lg">{t('list.title')}</h2>
        <InvestmentTransactionList transactions={transactions} />
      </section>
    </div>
  )
}
