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
import { analyzeRental } from './math'

export function RentalCalculator({ baseCurrency }: { baseCurrency: string }) {
  const t = useTranslations('profitabilityCalculator')
  const locale = useLocale()

  const [purchasePrice, setPurchasePrice] = useState(200000)
  const [downPaymentPct, setDownPaymentPct] = useState(20)
  const [mortgageRatePct, setMortgageRatePct] = useState(3.5)
  const [mortgageTermYears, setMortgageTermYears] = useState(25)
  const [monthlyRent, setMonthlyRent] = useState(900)
  const [monthlyOperatingExpenses, setMonthlyOperatingExpenses] = useState(150)
  const [vacancyPct, setVacancyPct] = useState(5)
  const [managementFeePct, setManagementFeePct] = useState(0)
  const [appreciationPct, setAppreciationPct] = useState(2)
  const [years, setYears] = useState(20)

  const analysis = useMemo(
    () =>
      analyzeRental({
        purchasePrice,
        downPaymentPct,
        mortgageRatePct,
        mortgageTermYears,
        monthlyRent,
        monthlyOperatingExpenses,
        vacancyPct,
        managementFeePct,
        appreciationPct,
        years,
      }),
    [
      purchasePrice,
      downPaymentPct,
      mortgageRatePct,
      mortgageTermYears,
      monthlyRent,
      monthlyOperatingExpenses,
      vacancyPct,
      managementFeePct,
      appreciationPct,
      years,
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

  const propertyValueLabel = t('rental.equityLabels.propertyValue')
  const loanBalanceLabel = t('rental.equityLabels.loanBalance')
  const equityLabel = t('rental.equityLabels.equity')
  const equityChartData = useMemo(
    () =>
      analysis.equityPoints.map((p) => ({
        year: p.year,
        [propertyValueLabel]: p.propertyValue,
        [loanBalanceLabel]: p.loanBalance,
        [equityLabel]: p.equity,
      })),
    [analysis.equityPoints, propertyValueLabel, loanBalanceLabel, equityLabel]
  )

  const profitable = analysis.monthlyCashFlow >= 0

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
      <GlassCard>
        <CardHeader className="p-0 pb-4">
          <CardTitle>{t('rental.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-0">
          <p className="text-ink-soft text-sm">{t('rental.description')}</p>
          <NumberField
            id="rental-price"
            label={t('rental.purchasePrice')}
            value={purchasePrice}
            onChange={setPurchasePrice}
          />
          <NumberField
            id="rental-down"
            label={t('rental.downPaymentPct')}
            value={downPaymentPct}
            onChange={setDownPaymentPct}
            step={1}
          />
          <NumberField
            id="rental-rate"
            label={t('rental.mortgageRate')}
            value={mortgageRatePct}
            onChange={setMortgageRatePct}
            step={0.1}
          />
          <NumberField
            id="rental-term"
            label={t('rental.mortgageTerm')}
            value={mortgageTermYears}
            onChange={setMortgageTermYears}
            min={1}
            step={1}
          />
          <NumberField
            id="rental-rent"
            label={t('rental.monthlyRent')}
            value={monthlyRent}
            onChange={setMonthlyRent}
          />
          <NumberField
            id="rental-expenses"
            label={t('rental.monthlyOperatingExpenses')}
            value={monthlyOperatingExpenses}
            onChange={setMonthlyOperatingExpenses}
          />
          <NumberField
            id="rental-vacancy"
            label={t('rental.vacancyPct')}
            value={vacancyPct}
            onChange={setVacancyPct}
            step={1}
          />
          <NumberField
            id="rental-management"
            label={t('rental.managementFeePct')}
            value={managementFeePct}
            onChange={setManagementFeePct}
            step={1}
          />
          <NumberField
            id="rental-appreciation"
            label={t('rental.appreciationPct')}
            value={appreciationPct}
            onChange={setAppreciationPct}
            step={0.1}
          />
          <NumberField
            id="rental-years"
            label={t('common.years')}
            value={years}
            onChange={setYears}
            min={1}
            step={1}
          />
        </CardContent>
      </GlassCard>

      <div className="flex flex-col gap-6">
        <div
          className={`rounded-2xl px-4 py-2 font-medium text-sm ${profitable ? 'bg-pos-soft text-pos' : 'bg-neg-soft text-neg'}`}
        >
          {profitable ? t('rental.profitable') : t('rental.unprofitable')}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <GlassCard>
            <CardContent className="flex flex-col gap-1 p-0">
              <span className="text-ink-soft text-xs">
                {t('rental.monthlyMortgagePayment')}
              </span>
              <Stat
                value={analysis.monthlyMortgagePayment * 100}
                currency={baseCurrency}
                locale={locale}
                className="text-2xl"
              />
            </CardContent>
          </GlassCard>
          <GlassCard>
            <CardContent className="flex flex-col gap-1 p-0">
              <span className="text-ink-soft text-xs">
                {t('rental.monthlyCashFlow')}
              </span>
              <Stat
                value={analysis.monthlyCashFlow * 100}
                currency={baseCurrency}
                locale={locale}
                className={`text-2xl ${profitable ? '' : 'text-neg'}`}
              />
            </CardContent>
          </GlassCard>
          <GlassCard>
            <CardContent className="flex flex-col gap-1 p-0">
              <span className="text-ink-soft text-xs">
                {t('rental.cashOnCashReturn')}
              </span>
              <Stat
                value={Math.round(analysis.cashOnCashReturnPct * 10) / 10}
                suffix="%"
                locale={locale}
                className="text-2xl"
              />
            </CardContent>
          </GlassCard>
          <GlassCard>
            <CardContent className="flex flex-col gap-1 p-0">
              <span className="text-ink-soft text-xs">
                {t('rental.capRate')}
              </span>
              <Stat
                value={Math.round(analysis.capRatePct * 10) / 10}
                suffix="%"
                locale={locale}
                className="text-2xl"
              />
            </CardContent>
          </GlassCard>
          <GlassCard>
            <CardContent className="flex flex-col gap-1 p-0">
              <span className="text-ink-soft text-xs">
                {t('rental.grossYield')}
              </span>
              <Stat
                value={Math.round(analysis.grossYieldPct * 10) / 10}
                suffix="%"
                locale={locale}
                className="text-2xl"
              />
            </CardContent>
          </GlassCard>
        </div>

        <GlassCard>
          <CardHeader className="p-0 pb-4">
            <CardTitle>{t('rental.equityChartTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <AreaChart
              categories={[propertyValueLabel, loanBalanceLabel, equityLabel]}
              index="year"
              data={equityChartData}
              tickFormatter={compactFmt}
              valueFormatter={fmt}
            />
          </CardContent>
        </GlassCard>
      </div>
    </div>
  )
}
