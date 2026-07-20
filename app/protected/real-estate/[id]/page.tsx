import { format, money } from '@finova/domain/money'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { Badge } from '@/components/ui/Badge'
import { GlassCard } from '@/components/ui/GlassCard'
import { requireUser } from '@/lib/auth/require-user'
import { deleteExpense, deleteRentalIncome, deleteValuation } from '../actions'
import { getPropertyDetail } from '../data'
import { DeleteRowButton } from './DeleteRowButton'
import {
  AddExpenseButton,
  AddIncomeButton,
  AddLoanButton,
  AddValuationButton,
} from './EntryForms'
import { LoanRowActions } from './LoanRowActions'
import { PropertyActions } from './PropertyActions'
import { ValuationChart } from './ValuationChart'

function pct(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(1)}%`
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireUser()
  const { id } = await params
  const detail = await getPropertyDetail(id)
  if (!detail) {
    notFound()
  }
  const [t, locale] = await Promise.all([
    getTranslations('realEstate'),
    getLocale(),
  ])
  const todayIso = new Date().toISOString().slice(0, 10)
  const { property, loans, incomes, expenses, valuations, metrics } = detail
  const ccy = property.currency
  const fmt = (cents: number) => format(money(cents, ccy), locale)
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
      new Date(`${iso}T00:00:00Z`)
    )

  const chartPoints = [...valuations]
    .sort((a, b) => a.valuation_date.localeCompare(b.valuation_date))
    .map((v) => ({ date: v.valuation_date, valueCents: v.value_cents }))

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <Link
        href="/protected/real-estate"
        className="flex items-center gap-1.5 text-ink-soft text-sm hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('detail.back')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-2xl">{property.name}</h1>
            {property.is_sold ? (
              <Badge variant="neutral">{t('card.sold')}</Badge>
            ) : null}
            {property.is_rented && !property.is_sold ? (
              <Badge variant="pos">{t('card.rented')}</Badge>
            ) : null}
          </div>
          <p className="text-ink-soft text-sm">
            {t(`types.${property.type}`)}
            {property.city ? ` · ${property.city}` : ''}
            {' · '}
            {property.is_sold && property.sold_date
              ? t('detail.soldOn', { date: fmtDate(property.sold_date) })
              : t('detail.purchasedOn', {
                  date: fmtDate(property.purchase_date),
                })}
          </p>
        </div>
        <PropertyActions
          propertyId={property.id}
          isSold={property.is_sold}
          todayIso={todayIso}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t('detail.currentValue')}
          value={property.current_value_cents}
          currency={ccy}
          locale={locale}
          footnote={t('detail.costBasis')}
        />
        <KpiCard
          label={t('detail.equity')}
          value={metrics.equityCents}
          currency={ccy}
          locale={locale}
        />
        <KpiCard
          label={t('detail.debt')}
          value={metrics.debtCents}
          currency={ccy}
          locale={locale}
          footnote={`${t('detail.ltv')} ${pct(metrics.ltvPct)}`}
        />
        <KpiCard
          label={t('detail.cashFlow')}
          value={metrics.monthlyCashFlowCents}
          currency={ccy}
          locale={locale}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: t('detail.costBasis'), value: fmt(metrics.costBasisCents) },
          {
            label: t('detail.annualRent'),
            value: fmt(metrics.annualRentCents),
          },
          { label: t('detail.grossYield'), value: pct(metrics.grossYieldPct) },
          { label: t('detail.netYield'), value: pct(metrics.netYieldPct) },
          { label: t('detail.roi'), value: pct(metrics.roiPct) },
          {
            label: t('detail.totalIncome'),
            value: fmt(metrics.totalIncomeCents),
          },
        ].map((s) => (
          <GlassCard key={s.label} className="flex flex-col gap-1 p-4">
            <span className="text-ink-soft text-xs">{s.label}</span>
            <span className="font-semibold text-ink text-sm">{s.value}</span>
          </GlassCard>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-lg">
            {t('detail.valuationsTitle')}
          </h2>
          <AddValuationButton propertyId={property.id} todayIso={todayIso} />
        </div>
        <GlassCard>
          {chartPoints.length > 1 ? (
            <ValuationChart
              currency={ccy}
              points={chartPoints}
              title={t('detail.currentValue')}
            />
          ) : (
            <p className="text-ink-soft text-sm">{t('detail.empty')}</p>
          )}
          {valuations.length > 0 ? (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-ink-soft">
                  <th className="py-2 pr-4 font-medium">{t('tables.date')}</th>
                  <th className="py-2 pr-4 text-right font-medium">
                    {t('tables.value')}
                  </th>
                  <th className="py-2 pr-4 font-medium">
                    {t('tables.source')}
                  </th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {valuations.map((v) => (
                  <tr key={v.id} className="border-glass-line border-t">
                    <td className="py-2 pr-4">{fmtDate(v.valuation_date)}</td>
                    <td className="py-2 pr-4 text-right">
                      {fmt(v.value_cents)}
                    </td>
                    <td className="py-2 pr-4 text-ink-soft">
                      {t(`valuationForm.sources.${v.source ?? 'manual'}`)}
                    </td>
                    <td className="py-2 text-right">
                      <DeleteRowButton action={deleteValuation} id={v.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </GlassCard>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-lg">{t('detail.loansTitle')}</h2>
          <AddLoanButton propertyId={property.id} todayIso={todayIso} />
        </div>
        <GlassCard className="overflow-x-auto">
          {loans.length === 0 ? (
            <p className="text-ink-soft text-sm">{t('detail.empty')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-soft">
                  <th className="py-2 pr-4 font-medium">
                    {t('tables.lender')}
                  </th>
                  <th className="py-2 pr-4 font-medium">{t('tables.type')}</th>
                  <th className="py-2 pr-4 text-right font-medium">
                    {t('tables.outstanding')}
                  </th>
                  <th className="py-2 pr-4 text-right font-medium">
                    {t('tables.rate')}
                  </th>
                  <th className="py-2 pr-4 text-right font-medium">
                    {t('tables.payment')}
                  </th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => (
                  <tr key={loan.id} className="border-glass-line border-t">
                    <td className="py-2 pr-4 font-medium text-ink">
                      {loan.lender_name}
                      {loan.is_paid_off ? (
                        <Badge variant="neutral" className="ml-2">
                          {t('tables.paidOff')}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4 text-ink-soft">
                      {t(`loanForm.loanTypes.${loan.loan_type}`)}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {fmt(loan.outstanding_cents)}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {loan.interest_rate_pct.toFixed(2)}%{' '}
                      <span className="text-ink-soft text-xs">
                        {t(`loanForm.rateTypes.${loan.rate_type}`)}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {fmt(loan.monthly_payment_cents)}
                    </td>
                    <td className="py-2 text-right">
                      <LoanRowActions loan={loan} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </GlassCard>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-lg">{t('detail.incomeTitle')}</h2>
          <AddIncomeButton
            propertyId={property.id}
            currency={ccy}
            todayIso={todayIso}
          />
        </div>
        <GlassCard className="overflow-x-auto">
          {incomes.length === 0 ? (
            <p className="text-ink-soft text-sm">{t('detail.empty')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-soft">
                  <th className="py-2 pr-4 font-medium">
                    {t('tables.period')}
                  </th>
                  <th className="py-2 pr-4 font-medium">
                    {t('tables.tenant')}
                  </th>
                  <th className="py-2 pr-4 text-right font-medium">
                    {t('tables.amount')}
                  </th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {incomes.map((income) => (
                  <tr key={income.id} className="border-glass-line border-t">
                    <td className="py-2 pr-4">
                      {fmtDate(income.period_start)} –{' '}
                      {fmtDate(income.period_end)}
                      {income.is_paid ? null : (
                        <Badge variant="neutral" className="ml-2">
                          {t('tables.pending')}
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-ink-soft">
                      {income.tenant_name ?? '—'}
                    </td>
                    <td className="py-2 pr-4 text-right text-pos">
                      {fmt(income.amount_cents)}
                    </td>
                    <td className="py-2 text-right">
                      <DeleteRowButton
                        action={deleteRentalIncome}
                        id={income.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </GlassCard>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-lg">{t('detail.expensesTitle')}</h2>
          <AddExpenseButton propertyId={property.id} todayIso={todayIso} />
        </div>
        <GlassCard className="overflow-x-auto">
          {expenses.length === 0 ? (
            <p className="text-ink-soft text-sm">{t('detail.empty')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-soft">
                  <th className="py-2 pr-4 font-medium">{t('tables.date')}</th>
                  <th className="py-2 pr-4 font-medium">
                    {t('tables.category')}
                  </th>
                  <th className="py-2 pr-4 font-medium">
                    {t('tables.description')}
                  </th>
                  <th className="py-2 pr-4 text-right font-medium">
                    {t('tables.amount')}
                  </th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="border-glass-line border-t">
                    <td className="py-2 pr-4">
                      {fmtDate(expense.expense_date)}
                    </td>
                    <td className="py-2 pr-4 text-ink-soft">
                      {t(`expenseForm.categories.${expense.category}`)}
                    </td>
                    <td className="py-2 pr-4">{expense.description}</td>
                    <td className="py-2 pr-4 text-right text-neg">
                      {fmt(expense.amount_cents)}
                    </td>
                    <td className="py-2 text-right">
                      <DeleteRowButton action={deleteExpense} id={expense.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </GlassCard>
      </section>
    </div>
  )
}
