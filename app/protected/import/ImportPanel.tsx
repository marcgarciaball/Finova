import { getTranslations } from 'next-intl/server'
import { DomainTabs } from '@/app/protected/data/DomainTabs'
import type { ExportView } from '@/app/protected/export/export-view'
import { EXPORT_VIEWS } from '@/app/protected/export/export-view'
import { GlassCard } from '@/components/ui/GlassCard'
import type { AccountRow } from '@/lib/validation/account'
import { BackupImport } from './BackupImport'
import { ImportClient } from './ImportClient'
import {
  commitInvestmentsBackup,
  reviewInvestmentsBackup,
} from './investments/actions'
import {
  commitRealEstateBackup,
  reviewRealEstateBackup,
} from './real-estate/actions'

const REAL_ESTATE_TABLES = [
  'properties',
  'loans',
  'valuations',
  'income',
  'expenses',
]
const INVESTMENTS_TABLES = ['portfolios', 'accounts', 'transactions']
const COMMON_ERRORS = [
  'malformed',
  'notFinova',
  'unsupportedVersion',
  'unexpected',
]

/**
 * Import surface, embedded as a tab of the merged Datos screen. A domain
 * selector (`?domain=`) mirrors Export. Transactions keeps its external-bank
 * wizard; Real Estate uses the round-trip JSON importer (Spec B). Investments
 * and Everything are wired in Specs C/D.
 */
export async function ImportPanel({
  view,
  accounts,
}: {
  view: ExportView
  accounts: AccountRow[]
}) {
  const t = await getTranslations('import')

  const labels = Object.fromEntries(
    EXPORT_VIEWS.map((v) => [v, t(`domains.${v}`)])
  ) as Record<ExportView, string>

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <DomainTabs value={view} ariaLabel={t('domainsLegend')} labels={labels} />

      {view === 'transactions' ? (
        <div className="flex flex-col gap-1">
          <p className="text-ink-soft text-sm">{t('subtitle')}</p>
          <ImportClient accounts={accounts} />
        </div>
      ) : null}

      {view === 'realEstate' ? (
        <BackupImport
          namespace="import.realEstate"
          tables={REAL_ESTATE_TABLES}
          knownErrors={[...COMMON_ERRORS, 'noRealEstate']}
          review={reviewRealEstateBackup}
          commit={commitRealEstateBackup}
        />
      ) : null}

      {view === 'investments' ? (
        <BackupImport
          namespace="import.investments"
          tables={INVESTMENTS_TABLES}
          knownErrors={[...COMMON_ERRORS, 'noInvestments']}
          review={reviewInvestmentsBackup}
          commit={commitInvestmentsBackup}
        />
      ) : null}

      {view === 'everything' ? (
        <GlassCard>
          <p className="text-ink-soft text-sm">{t('comingSoon')}</p>
        </GlassCard>
      ) : null}
    </div>
  )
}
