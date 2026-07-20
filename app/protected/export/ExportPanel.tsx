import { getTranslations } from 'next-intl/server'
import { DomainTabs } from '@/app/protected/data/DomainTabs'
import {
  listAccountsForPicker,
  listCategoriesForPicker,
} from '@/app/protected/transactions/data'
import { ExportFilters } from './ExportFilters'
import type { ExportView } from './export-view'
import { EXPORT_VIEWS } from './export-view'

/**
 * Export surface (P4-05 + Spec A), embedded as a tab of the merged Datos
 * screen. A domain selector (`?domain=`) chooses what to export — Everything,
 * Transactions, Investments or Real Estate — and the body renders the matching
 * download cards, plus a shared filter bar for the transaction-bearing views.
 * Files stream from the sibling RLS-scoped route handlers.
 */
export async function ExportPanel({ view }: { view: ExportView }) {
  const t = await getTranslations('export')
  const [accounts, categories] = await Promise.all([
    listAccountsForPicker(),
    listCategoriesForPicker(),
  ])

  const labels = Object.fromEntries(
    EXPORT_VIEWS.map((v) => [v, t(`domains.${v}`)])
  ) as Record<ExportView, string>

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <p className="max-w-2xl text-ink-soft text-sm">{t('description')}</p>
      <DomainTabs value={view} ariaLabel={t('domainsLegend')} labels={labels} />
      <ExportFilters view={view} accounts={accounts} categories={categories} />
    </div>
  )
}
