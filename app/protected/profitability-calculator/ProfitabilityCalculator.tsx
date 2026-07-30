'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { DividendCalculator } from './DividendCalculator'
import { GoalCalculator } from './GoalCalculator'
import { GrowthCalculator } from './GrowthCalculator'
import { HistoricalCalculator } from './HistoricalCalculator'
import { RentalCalculator } from './RentalCalculator'

type Tab = 'goal' | 'growth' | 'historical' | 'dividends' | 'rental'

export function ProfitabilityCalculator({
  baseCurrency,
}: {
  baseCurrency: string
}) {
  const t = useTranslations('profitabilityCalculator')
  const [tab, setTab] = useState<Tab>('growth')

  return (
    <div className="flex flex-col gap-6">
      <SegmentedControl
        aria-label={t('title')}
        value={tab}
        onValueChange={(next) => setTab(next as Tab)}
        className="flex-wrap"
        options={[
          { value: 'growth', label: t('tabs.growth') },
          { value: 'goal', label: t('tabs.goal') },
          { value: 'historical', label: t('tabs.historical') },
          { value: 'dividends', label: t('tabs.dividends') },
          { value: 'rental', label: t('tabs.rental') },
        ]}
      />
      {tab === 'growth' ? (
        <GrowthCalculator baseCurrency={baseCurrency} />
      ) : null}
      {tab === 'goal' ? <GoalCalculator baseCurrency={baseCurrency} /> : null}
      {tab === 'historical' ? (
        <HistoricalCalculator baseCurrency={baseCurrency} />
      ) : null}
      {tab === 'dividends' ? (
        <DividendCalculator baseCurrency={baseCurrency} />
      ) : null}
      {tab === 'rental' ? (
        <RentalCalculator baseCurrency={baseCurrency} />
      ) : null}
    </div>
  )
}
