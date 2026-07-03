import { getTranslations } from 'next-intl/server'
import {
  listAccountsForPicker,
  listCategoriesForPicker,
} from '@/app/protected/transactions/data'
import { ExportFilters } from './ExportFilters'

/**
 * Export surface (P4-05), embedded as a tab of the merged Datos screen (nav IA
 * priority 2). A shared filter bar (date range / category / account) feeds two
 * downloads: the transactions CSV ledger (re-imports cleanly) and the full
 * JSON bundle. The actual files stream from the sibling route handlers,
 * RLS-scoped.
 */
export async function ExportPanel() {
  const t = await getTranslations('export')
  const [accounts, categories] = await Promise.all([
    listAccountsForPicker(),
    listCategoriesForPicker(),
  ])

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <p className="max-w-2xl text-ink-soft text-sm">{t('description')}</p>
      <ExportFilters accounts={accounts} categories={categories} />
    </div>
  )
}
