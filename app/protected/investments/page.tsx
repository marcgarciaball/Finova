import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/auth/require-user'
import { refreshPrices } from '@/lib/investments/jobs/refresh-prices'
import { AddInvestmentButton } from './AddInvestmentButton'
import { getOrCreatePortfolio, listInvestmentTransactions } from './data'
import { IncomeSection } from './IncomeSection'
import { InvestmentsOverviewSection } from './InvestmentsOverview'
import { InvestmentsTabs } from './InvestmentsTabs'
import { getInvestmentsIncome } from './income-data'
import { parseInvestmentsTab } from './investments-tab'
import { getInvestmentsOverview } from './overview-data'
import { InvestmentTransactionList } from './transaction-list'

/**
 * Inversiones: manual portfolio tracker. URL-driven tabs (Overview / Income /
 * Transactions); the add flow lives in a header dialog. Prices self-refresh
 * when quotes are missing or older than 30 minutes.
 */
export default async function InvestmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  await requireUser()
  await getOrCreatePortfolio() // first-visit bootstrap
  const tab = parseInvestmentsTab((await searchParams).tab)
  const t = await getTranslations('investments')
  const todayIso = new Date().toISOString().slice(0, 10)

  let overview = await getInvestmentsOverview()
  const STALE_MS = 30 * 60 * 1000
  // Only quote AGE triggers the inline refresh — never unpriced assets, so a
  // symbol without provider coverage can't burn API quota on every load.
  const stale =
    overview.hasTransactions &&
    (!overview.latestFetchedAt ||
      Date.now() - new Date(overview.latestFetchedAt).getTime() > STALE_MS)
  if (stale) {
    try {
      await refreshPrices()
      overview = await getInvestmentsOverview()
    } catch (e) {
      console.error('inline price refresh failed:', e)
    }
  }

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-bold text-2xl">{t('title')}</h1>
          <p className="text-ink-soft text-sm">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <InvestmentsTabs
            value={tab}
            ariaLabel={t('title')}
            overviewLabel={t('tabs.overview')}
            incomeLabel={t('tabs.income')}
            transactionsLabel={t('tabs.transactions')}
          />
          <AddInvestmentButton todayIso={todayIso} />
        </div>
      </div>

      {tab === 'overview' ? (
        <InvestmentsOverviewSection overview={overview} />
      ) : null}
      {tab === 'income' ? (
        <IncomeSection income={await getInvestmentsIncome()} />
      ) : null}
      {tab === 'transactions' ? (
        <InvestmentTransactionList
          transactions={await listInvestmentTransactions()}
        />
      ) : null}
    </div>
  )
}
