import { getTranslations } from 'next-intl/server'
import { getBaseCurrency } from '@/app/protected/transactions/data'
import { requireUser } from '@/lib/auth/require-user'
import { ProfitabilityCalculator } from './ProfitabilityCalculator'

export default async function ProfitabilityCalculatorPage() {
  await requireUser()
  const [t, baseCurrency] = await Promise.all([
    getTranslations('profitabilityCalculator'),
    getBaseCurrency(),
  ])

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-bold text-2xl">{t('title')}</h1>
          <p className="text-ink-soft text-sm">{t('subtitle')}</p>
        </div>
      </div>

      <ProfitabilityCalculator baseCurrency={baseCurrency} />
    </div>
  )
}
