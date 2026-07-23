import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/auth/require-user'
import { AddAssetButton } from './AddAssetButton'
import { getManualAssetsOverview } from './data'
import { ManualAssetsOverviewSection } from './ManualAssetsOverview'
import { parseManualAssetsSort } from './sort'

export default async function ManualAssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>
}) {
  await requireUser()
  const t = await getTranslations('manualAssets')
  const todayIso = new Date().toISOString().slice(0, 10)
  const overview = await getManualAssetsOverview()
  const sort = parseManualAssetsSort(await searchParams)

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-bold text-2xl">{t('title')}</h1>
          <p className="text-ink-soft text-sm">{t('subtitle')}</p>
        </div>
        <AddAssetButton todayIso={todayIso} />
      </div>

      <ManualAssetsOverviewSection overview={overview} sort={sort} />
    </div>
  )
}
