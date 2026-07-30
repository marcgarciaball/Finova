'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { AreaChart } from '@/components/charts/AreaChart'
import { DonutChart } from '@/components/charts/DonutChart'
import {
  CardContent,
  CardHeader,
  CardTitle,
  GlassCard,
} from '@/components/ui/GlassCard'
import { Stat } from '@/components/ui/Stat'
import { Field, NumberField, SELECT_CLASS } from './CalcFormBits'
import {
  compactCurrencyFormatter,
  currencyFormatter,
} from './currencyFormatter'
import type { CompoundingFrequency } from './math'
import { projectGrowth } from './math'

export function GrowthCalculator({ baseCurrency }: { baseCurrency: string }) {
  const t = useTranslations('profitabilityCalculator')
  const locale = useLocale()

  const [initialCapital, setInitialCapital] = useState(10000)
  const [monthlyContribution, setMonthlyContribution] = useState(300)
  const [annualRatePct, setAnnualRatePct] = useState(7)
  const [years, setYears] = useState(20)
  const [compounding, setCompounding] =
    useState<CompoundingFrequency>('monthly')

  const result = useMemo(
    () =>
      projectGrowth({
        initialCapital,
        monthlyContribution,
        annualRatePct,
        years,
        compounding,
      }),
    [initialCapital, monthlyContribution, annualRatePct, years, compounding]
  )

  const fmt = useMemo(
    () => currencyFormatter(locale, baseCurrency),
    [locale, baseCurrency]
  )
  const compactFmt = useMemo(
    () => compactCurrencyFormatter(locale, baseCurrency),
    [locale, baseCurrency]
  )

  const balanceLabel = t('common.balanceLabel')
  const chartData = useMemo(
    () =>
      result.points.map((p) => ({ year: p.year, [balanceLabel]: p.balance })),
    [result.points, balanceLabel]
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
      <GlassCard>
        <CardHeader className="p-0 pb-4">
          <CardTitle>{t('growth.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-0">
          <p className="text-ink-soft text-sm">{t('growth.description')}</p>
          <NumberField
            id="growth-initial"
            label={t('common.initialCapital')}
            value={initialCapital}
            onChange={setInitialCapital}
          />
          <NumberField
            id="growth-contribution"
            label={t('common.monthlyContribution')}
            value={monthlyContribution}
            onChange={setMonthlyContribution}
          />
          <NumberField
            id="growth-rate"
            label={t('common.annualReturn')}
            value={annualRatePct}
            onChange={setAnnualRatePct}
            step={0.1}
          />
          <NumberField
            id="growth-years"
            label={t('common.years')}
            value={years}
            onChange={setYears}
            min={1}
            step={1}
          />
          <Field id="growth-compounding" label={t('common.compounding')}>
            <select
              id="growth-compounding"
              className={SELECT_CLASS}
              value={compounding}
              onChange={(e) =>
                setCompounding(e.target.value as CompoundingFrequency)
              }
            >
              <option value="monthly">
                {t('common.compoundingOptions.monthly')}
              </option>
              <option value="quarterly">
                {t('common.compoundingOptions.quarterly')}
              </option>
              <option value="annually">
                {t('common.compoundingOptions.annually')}
              </option>
            </select>
          </Field>
        </CardContent>
      </GlassCard>

      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <GlassCard>
            <CardContent className="flex flex-col gap-1 p-0">
              <span className="text-ink-soft text-xs">
                {t('growth.futureValue')}
              </span>
              <Stat
                value={result.futureValue * 100}
                currency={baseCurrency}
                locale={locale}
                className="text-2xl"
              />
            </CardContent>
          </GlassCard>
          <GlassCard>
            <CardContent className="flex flex-col gap-1 p-0">
              <span className="text-ink-soft text-xs">
                {t('growth.totalContributed')}
              </span>
              <Stat
                value={result.totalContributed * 100}
                currency={baseCurrency}
                locale={locale}
                className="text-2xl"
              />
            </CardContent>
          </GlassCard>
          <GlassCard>
            <CardContent className="flex flex-col gap-1 p-0">
              <span className="text-ink-soft text-xs">
                {t('growth.totalInterest')}
              </span>
              <Stat
                value={result.totalInterest * 100}
                currency={baseCurrency}
                locale={locale}
                className="text-2xl"
              />
            </CardContent>
          </GlassCard>
        </div>

        <GlassCard>
          <CardHeader className="p-0 pb-4">
            <CardTitle>{t('growth.chartTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <AreaChart
              categories={[balanceLabel]}
              index="year"
              data={chartData}
              tickFormatter={compactFmt}
              valueFormatter={fmt}
            />
          </CardContent>
        </GlassCard>

        <GlassCard>
          <CardHeader className="p-0 pb-4">
            <CardTitle>{t('growth.breakdownTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DonutChart
              data={[
                {
                  name: t('growth.breakdown.contributed'),
                  value: Math.max(0, result.totalContributed),
                },
                {
                  name: t('growth.breakdown.interest'),
                  value: Math.max(0, result.totalInterest),
                },
              ]}
            />
            <div className="mt-2 flex justify-center gap-4 text-ink-soft text-xs">
              <span>
                {t('growth.breakdown.contributed')}:{' '}
                {fmt(result.totalContributed)}
              </span>
              <span>
                {t('growth.breakdown.interest')}: {fmt(result.totalInterest)}
              </span>
            </div>
          </CardContent>
        </GlassCard>
      </div>
    </div>
  )
}
