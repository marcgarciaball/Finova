import { getTranslations } from 'next-intl/server'
import { getPropertiesForPicker } from '@/app/protected/real-estate/data'
import { requireUser } from '@/lib/auth/require-user'
import { AddDebtButton } from './AddDebtButton'
import { DebtsOverviewSection } from './DebtsOverview'
import { getDebtsOverview } from './data'
import { parseDebtsSort } from './sort'

export default async function DebtsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>
}) {
  await requireUser()
  const t = await getTranslations('debts')
  const todayIso = new Date().toISOString().slice(0, 10)
  const [overview, properties] = await Promise.all([
    getDebtsOverview(),
    getPropertiesForPicker(),
  ])
  const sort = parseDebtsSort(await searchParams)

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-bold text-2xl">{t('title')}</h1>
          <p className="text-ink-soft text-sm">{t('subtitle')}</p>
        </div>
        <AddDebtButton properties={properties} todayIso={todayIso} />
      </div>

      <DebtsOverviewSection overview={overview} sort={sort} />
    </div>
  )
}
