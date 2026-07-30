'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { AreaChart } from '@/components/charts/AreaChart'
import {
  CardContent,
  CardHeader,
  CardTitle,
  GlassCard,
} from '@/components/ui/GlassCard'
import { Stat } from '@/components/ui/Stat'
import { NumberField } from './CalcFormBits'
import {
  compactCurrencyFormatter,
  currencyFormatter,
} from './currencyFormatter'
import {
  capitalRequiredForIncome,
  projectGrowth,
  yearsToReachCapital,
} from './math'

export function GoalCalculator({ baseCurrency }: { baseCurrency: string }) {
  const t = useTranslations('profitabilityCalculator')
  const locale = useLocale()

  const [monthlyIncomeTarget, setMonthlyIncomeTarget] = useState(1000)
  const [annualRatePct, setAnnualRatePct] = useState(4)
  const [initialCapital, setInitialCapital] = useState(10000)
  const [monthlyContribution, setMonthlyContribution] = useState(500)

  const capitalRequired = useMemo(
    () => capitalRequiredForIncome(monthlyIncomeTarget, annualRatePct),
    [monthlyIncomeTarget, annualRatePct]
  )

  const yearsToReach = useMemo(
    () =>
      yearsToReachCapital({
        targetCapital: capitalRequired,
        initialCapital,
        monthlyContribution,
        annualRatePct,
        compounding: 'monthly',
      }),
    [capitalRequired, initialCapital, monthlyContribution, annualRatePct]
  )

  const chartYears = yearsToReach ?? 60
  const projection = useMemo(
    () =>
      projectGrowth({
        initialCapital,
        monthlyContribution,
        annualRatePct,
        years: chartYears,
        compounding: 'monthly',
      }),
    [initialCapital, monthlyContribution, annualRatePct, chartYears]
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
      projection.points.map((p) => ({
        year: p.year,
        [balanceLabel]: p.balance,
      })),
    [projection.points, balanceLabel]
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
      <GlassCard>
        <CardHeader className="p-0 pb-4">
          <CardTitle>{t('goal.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-0">
          <p className="text-ink-soft text-sm">{t('goal.description')}</p>
          <NumberField
            id="goal-income"
            label={t('goal.monthlyIncomeTarget')}
            value={monthlyIncomeTarget}
            onChange={setMonthlyIncomeTarget}
          />
          <NumberField
            id="goal-rate"
            label={t('common.annualReturn')}
            value={annualRatePct}
            onChange={setAnnualRatePct}
            step={0.1}
          />
          <NumberField
            id="goal-initial"
            label={t('common.initialCapital')}
            value={initialCapital}
            onChange={setInitialCapital}
          />
          <NumberField
            id="goal-contribution"
            label={t('common.monthlyContribution')}
            value={monthlyContribution}
            onChange={setMonthlyContribution}
          />
        </CardContent>
      </GlassCard>

      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <GlassCard>
            <CardContent className="flex flex-col gap-1 p-0">
              <span className="text-ink-soft text-xs">
                {t('goal.capitalRequired')}
              </span>
              <Stat
                value={capitalRequired * 100}
                currency={baseCurrency}
                locale={locale}
                className="text-2xl"
              />
              <span className="text-ink-soft text-xs">
                {t('goal.capitalRequiredHint', {
                  income: fmt(monthlyIncomeTarget),
                  rate: annualRatePct,
                })}
              </span>
            </CardContent>
          </GlassCard>
          <GlassCard>
            <CardContent className="flex flex-col gap-1 p-0">
              <span className="text-ink-soft text-xs">
                {t('goal.yearsToReachTitle')}
              </span>
              {yearsToReach === null ? (
                <p className="text-neg text-sm">{t('goal.neverReaches')}</p>
              ) : (
                <>
                  <Stat
                    value={Math.round(yearsToReach * 10) / 10}
                    locale={locale}
                    className="text-2xl"
                  />
                  <span className="text-ink-soft text-xs">
                    {t('goal.yearsToReachBody', {
                      contribution: fmt(monthlyContribution),
                      rate: annualRatePct,
                      initial: fmt(initialCapital),
                    })}
                  </span>
                </>
              )}
            </CardContent>
          </GlassCard>
        </div>

        <GlassCard>
          <CardHeader className="p-0 pb-4">
            <CardTitle>{t('goal.chartTitle')}</CardTitle>
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
      </div>
    </div>
  )
}
