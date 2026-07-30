'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { AreaChart } from '@/components/charts/AreaChart'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  CardContent,
  CardHeader,
  CardTitle,
  GlassCard,
} from '@/components/ui/GlassCard'
import { Label } from '@/components/ui/Label'
import { Stat } from '@/components/ui/Stat'
import { Field, NumberField } from './CalcFormBits'
import {
  compactCurrencyFormatter,
  currencyFormatter,
} from './currencyFormatter'
import { projectDividends, yearsToReachDividendIncome } from './math'

export function DividendCalculator({ baseCurrency }: { baseCurrency: string }) {
  const t = useTranslations('profitabilityCalculator')
  const locale = useLocale()

  const [initialCapital, setInitialCapital] = useState(10000)
  const [monthlyContribution, setMonthlyContribution] = useState(200)
  const [dividendYieldPct, setDividendYieldPct] = useState(4)
  const [dividendGrowthPct, setDividendGrowthPct] = useState(5)
  const [priceAppreciationPct, setPriceAppreciationPct] = useState(3)
  const [years, setYears] = useState(20)
  const [reinvest, setReinvest] = useState(true)
  const [targetMonthlyIncome, setTargetMonthlyIncome] = useState(2000)

  const result = useMemo(
    () =>
      projectDividends({
        initialCapital,
        monthlyContribution,
        dividendYieldPct,
        dividendGrowthPct,
        priceAppreciationPct,
        years,
        reinvest,
      }),
    [
      initialCapital,
      monthlyContribution,
      dividendYieldPct,
      dividendGrowthPct,
      priceAppreciationPct,
      years,
      reinvest,
    ]
  )

  const yearsToReachIncome = useMemo(
    () =>
      yearsToReachDividendIncome({
        initialCapital,
        monthlyContribution,
        dividendYieldPct,
        dividendGrowthPct,
        priceAppreciationPct,
        targetMonthlyIncome,
      }),
    [
      initialCapital,
      monthlyContribution,
      dividendYieldPct,
      dividendGrowthPct,
      priceAppreciationPct,
      targetMonthlyIncome,
    ]
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
  const balanceChartData = useMemo(
    () =>
      result.points.map((p) => ({ year: p.year, [balanceLabel]: p.balance })),
    [result.points, balanceLabel]
  )

  const incomeLabel = t('dividends.annualIncomeLabel')
  const incomeChartData = useMemo(
    () =>
      result.points.map((p) => ({
        year: p.year,
        [incomeLabel]: p.dividendIncome,
      })),
    [result.points, incomeLabel]
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
      <GlassCard>
        <CardHeader className="p-0 pb-4">
          <CardTitle>{t('dividends.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-0">
          <p className="text-ink-soft text-sm">{t('dividends.description')}</p>
          <NumberField
            id="div-initial"
            label={t('common.initialCapital')}
            value={initialCapital}
            onChange={setInitialCapital}
          />
          <NumberField
            id="div-contribution"
            label={t('common.monthlyContribution')}
            value={monthlyContribution}
            onChange={setMonthlyContribution}
          />
          <NumberField
            id="div-yield"
            label={t('dividends.dividendYield')}
            value={dividendYieldPct}
            onChange={setDividendYieldPct}
            step={0.1}
          />
          <NumberField
            id="div-growth"
            label={t('dividends.dividendGrowth')}
            value={dividendGrowthPct}
            onChange={setDividendGrowthPct}
            step={0.1}
          />
          <NumberField
            id="div-appreciation"
            label={t('dividends.priceAppreciation')}
            value={priceAppreciationPct}
            onChange={setPriceAppreciationPct}
            step={0.1}
          />
          <p className="text-ink-soft text-xs">
            {t('dividends.priceAppreciationHint')}
          </p>
          <NumberField
            id="div-years"
            label={t('common.years')}
            value={years}
            onChange={setYears}
            min={1}
            step={1}
          />
          <Field id="div-reinvest" label={t('dividends.reinvest')}>
            <div className="flex items-center gap-2">
              <Checkbox
                id="div-reinvest"
                checked={reinvest}
                onCheckedChange={(checked) => setReinvest(checked === true)}
              />
              <Label htmlFor="div-reinvest" className="font-normal text-sm">
                {t('dividends.reinvestHint')}
              </Label>
            </div>
          </Field>
        </CardContent>
      </GlassCard>

      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <GlassCard>
            <CardContent className="flex flex-col gap-1 p-0">
              <span className="text-ink-soft text-xs">
                {t('dividends.futureValue')}
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
                {t('dividends.finalAnnualIncome', { years })}
              </span>
              <Stat
                value={result.finalAnnualIncome * 100}
                currency={baseCurrency}
                locale={locale}
                className="text-2xl"
              />
            </CardContent>
          </GlassCard>
          <GlassCard>
            <CardContent className="flex flex-col gap-1 p-0">
              <span className="text-ink-soft text-xs">
                {t('dividends.totalDividendsReceived')}
              </span>
              <Stat
                value={result.totalDividendsReceived * 100}
                currency={baseCurrency}
                locale={locale}
                className="text-2xl"
              />
            </CardContent>
          </GlassCard>
        </div>

        <GlassCard>
          <CardHeader className="p-0 pb-4">
            <CardTitle>{t('dividends.chartTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <AreaChart
              categories={[balanceLabel]}
              index="year"
              data={balanceChartData}
              tickFormatter={compactFmt}
              valueFormatter={fmt}
            />
          </CardContent>
        </GlassCard>

        <GlassCard>
          <CardHeader className="p-0 pb-4">
            <CardTitle>{t('dividends.incomeChartTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <AreaChart
              categories={[incomeLabel]}
              index="year"
              data={incomeChartData}
              tickFormatter={compactFmt}
              valueFormatter={fmt}
            />
          </CardContent>
        </GlassCard>

        <GlassCard>
          <CardHeader className="p-0 pb-4">
            <CardTitle>{t('dividends.goalTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 p-0">
            <p className="text-ink-soft text-sm">
              {t('dividends.goalDescription', {
                contribution: fmt(monthlyContribution),
              })}
            </p>
            <div className="max-w-xs">
              <NumberField
                id="div-goal-income"
                label={t('dividends.targetMonthlyIncome')}
                value={targetMonthlyIncome}
                onChange={setTargetMonthlyIncome}
              />
            </div>
            <div>
              <span className="text-ink-soft text-xs">
                {t('dividends.yearsToReachIncome')}
              </span>
              {yearsToReachIncome === null ? (
                <p className="text-neg text-sm">
                  {t('dividends.neverReachesIncome')}
                </p>
              ) : (
                <Stat
                  value={Math.round(yearsToReachIncome * 10) / 10}
                  locale={locale}
                  className="text-2xl"
                />
              )}
            </div>
          </CardContent>
        </GlassCard>
      </div>
    </div>
  )
}
