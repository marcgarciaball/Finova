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
import { NumberField } from './CalcFormBits'
import {
  compactCurrencyFormatter,
  currencyFormatter,
} from './currencyFormatter'
import { projectGrowth } from './math'

const PRESETS = [
  { key: 'worldStocks', rate: 8 },
  { key: 'usStocks', rate: 10 },
  { key: 'realEstate', rate: 6 },
  { key: 'bonds', rate: 4 },
] as const

export function HistoricalCalculator({
  baseCurrency,
}: {
  baseCurrency: string
}) {
  const t = useTranslations('profitabilityCalculator')
  const locale = useLocale()

  const [initialCapital, setInitialCapital] = useState(10000)
  const [monthlyContribution, setMonthlyContribution] = useState(300)
  const [years, setYears] = useState(20)
  const [customRate, setCustomRate] = useState(5)

  const fmt = useMemo(
    () => currencyFormatter(locale, baseCurrency),
    [locale, baseCurrency]
  )
  const compactFmt = useMemo(
    () => compactCurrencyFormatter(locale, baseCurrency),
    [locale, baseCurrency]
  )

  const scenarios = useMemo(() => {
    const all = [
      ...PRESETS.map((p) => ({
        key: p.key,
        label: t(`historical.presets.${p.key}`),
        rate: p.rate,
      })),
      {
        key: 'custom',
        label: t('historical.presets.custom'),
        rate: customRate,
      },
    ]
    return all.map((scenario) => ({
      ...scenario,
      result: projectGrowth({
        initialCapital,
        monthlyContribution,
        annualRatePct: scenario.rate,
        years,
        compounding: 'monthly',
      }),
    }))
  }, [initialCapital, monthlyContribution, years, customRate, t])

  const chartData = useMemo(() => {
    const byYear = new Map<number, Record<string, number | string>>()
    for (const scenario of scenarios) {
      for (const point of scenario.result.points) {
        const row = byYear.get(point.year) ?? { year: point.year }
        row[scenario.label] = point.balance
        byYear.set(point.year, row)
      }
    }
    return [...byYear.values()].sort(
      (a, b) => (a.year as number) - (b.year as number)
    )
  }, [scenarios])

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
      <GlassCard>
        <CardHeader className="p-0 pb-4">
          <CardTitle>{t('historical.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-0">
          <p className="text-ink-soft text-sm">{t('historical.description')}</p>
          <NumberField
            id="hist-initial"
            label={t('common.initialCapital')}
            value={initialCapital}
            onChange={setInitialCapital}
          />
          <NumberField
            id="hist-contribution"
            label={t('common.monthlyContribution')}
            value={monthlyContribution}
            onChange={setMonthlyContribution}
          />
          <NumberField
            id="hist-years"
            label={t('common.years')}
            value={years}
            onChange={setYears}
            min={1}
            step={1}
          />
          <NumberField
            id="hist-custom-rate"
            label={t('historical.customRate')}
            value={customRate}
            onChange={setCustomRate}
            step={0.1}
          />
        </CardContent>
      </GlassCard>

      <div className="flex flex-col gap-6">
        <GlassCard>
          <CardHeader className="p-0 pb-4">
            <CardTitle>{t('historical.chartTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <AreaChart
              categories={scenarios.map((s) => s.label)}
              index="year"
              data={chartData}
              tickFormatter={compactFmt}
              valueFormatter={fmt}
            />
          </CardContent>
        </GlassCard>

        <GlassCard>
          <CardHeader className="p-0 pb-4">
            <CardTitle>{t('historical.tableTitle', { years })}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-glass-line border-b text-ink-soft">
                    <th className="py-2 text-left font-medium">
                      {t('historical.columnScenario')}
                    </th>
                    <th className="py-2 text-right font-medium">
                      {t('historical.columnRate')}
                    </th>
                    <th className="py-2 text-right font-medium">
                      {t('historical.columnFinalValue')}
                    </th>
                    <th className="py-2 text-right font-medium">
                      {t('historical.columnInterest')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((scenario) => (
                    <tr
                      key={scenario.key}
                      className="border-glass-line/50 border-b last:border-0"
                    >
                      <td className="py-2">{scenario.label}</td>
                      <td className="py-2 text-right tabular-nums">
                        {scenario.rate.toFixed(1)}%
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {fmt(scenario.result.futureValue)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {fmt(scenario.result.totalInterest)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </GlassCard>
      </div>
    </div>
  )
}
