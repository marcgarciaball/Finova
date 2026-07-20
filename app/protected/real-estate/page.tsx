import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/auth/require-user'
import { AddPropertyButton } from './AddPropertyButton'
import { getRealEstateOverview } from './data'
import { RealEstateOverviewSection } from './RealEstateOverview'

export default async function RealEstatePage() {
  await requireUser()
  const t = await getTranslations('realEstate')
  const todayIso = new Date().toISOString().slice(0, 10)
  const overview = await getRealEstateOverview()

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-bold text-2xl">{t('title')}</h1>
          <p className="text-ink-soft text-sm">{t('subtitle')}</p>
        </div>
        <AddPropertyButton todayIso={todayIso} />
      </div>

      <RealEstateOverviewSection overview={overview} />
    </div>
  )
}
