import { getTranslations } from 'next-intl/server'
import { listAccounts } from '@/app/protected/accounts/data'
import { ExportPanel } from '@/app/protected/export/ExportPanel'
import { parseExportView } from '@/app/protected/export/export-view'
import { ImportClient } from '@/app/protected/import/ImportClient'
import { requireUser } from '@/lib/auth/require-user'
import { DataTabs } from './DataTabs'
import { parseDataTab } from './data-tab'

/**
 * Merged Import/Export screen (nav IA priority 2): one "Datos" destination
 * instead of two separate top-level tabs, reached from the avatar menu.
 */
export default async function DataPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; domain?: string }>
}) {
  await requireUser()
  const sp = await searchParams
  const tab = parseDataTab(sp.tab)
  const view = parseExportView(sp.domain)

  const [t, tImport, tExport, accounts] = await Promise.all([
    getTranslations('data'),
    getTranslations('import'),
    getTranslations('export'),
    listAccounts(),
  ])

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-bold text-2xl">{t('title')}</h1>
        <DataTabs
          value={tab}
          ariaLabel={t('title')}
          importLabel={tImport('nav')}
          exportLabel={tExport('nav')}
        />
      </div>

      {tab === 'import' ? (
        <div className="flex flex-col gap-1">
          <p className="text-ink-soft text-sm">{tImport('subtitle')}</p>
          <ImportClient accounts={accounts} />
        </div>
      ) : (
        <ExportPanel view={view} />
      )}
    </div>
  )
}
