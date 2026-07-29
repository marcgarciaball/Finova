import { format, money } from '@finova/domain/money'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { Badge } from '@/components/ui/Badge'
import { GlassCard } from '@/components/ui/GlassCard'
import { requireUser } from '@/lib/auth/require-user'
import { deleteExpense, deleteValuation } from '../actions'
import { getPropertyDetail } from '../data'
import {
  AddExpenseButton,
  AddIncomeButton,
  AddLoanButton,
  AddValuationButton,
} from './EntryForms'
import { ExpensesTable } from './ExpensesTable'
import { IncomeTable } from './IncomeTable'
import { LoansTable } from './LoansTable'
import { PropertyActions } from './PropertyActions'
import { ValuationChart } from './ValuationChart'
import { ValuationsTable } from './ValuationsTable'

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

  const valuationRows = valuations.map((v) => ({
    id: v.id,
    valuationDate: v.valuation_date,
    dateLabel: fmtDate(v.valuation_date),
    valueCents: v.value_cents,
    valueLabel: fmt(v.value_cents),
    sourceLabel: t(`valuationForm.sources.${v.source ?? 'manual'}`),
  }))

  const loanRows = loans.map((loan) => ({
    loan,
    lenderName: loan.lender_name,
    typeLabel: t(`loanForm.loanTypes.${loan.loan_type}`),
    outstandingCents: loan.outstanding_cents,
    outstandingLabel: fmt(loan.outstanding_cents),
    ratePct: loan.interest_rate_pct,
    rateLabel: `${loan.interest_rate_pct.toFixed(2)}%`,
    rateTypeLabel: t(`loanForm.rateTypes.${loan.rate_type}`),
    paymentCents: loan.monthly_payment_cents,
    paymentLabel: fmt(loan.monthly_payment_cents),
    paidOffLabel: t('tables.paidOff'),
  }))

  const incomeRows = incomes.map((income) => ({
    id: income.id,
    income,
    periodStart: income.period_start,
    periodLabel: `${fmtDate(income.period_start)} – ${fmtDate(income.period_end)}`,
    tenantSortKey: income.tenant_name ?? '',
    tenantLabel: income.tenant_name ?? '—',
    amountCents: income.amount_cents,
    amountLabel: fmt(income.amount_cents),
    isPaid: income.is_paid,
    pendingLabel: t('tables.pending'),
  }))

  const expenseRows = expenses.map((expense) => ({
    id: expense.id,
    expenseDate: expense.expense_date,
    dateLabel: fmtDate(expense.expense_date),
    categoryLabel: t(`expenseForm.categories.${expense.category}`),
    description: expense.description,
    amountCents: expense.amount_cents,
    amountLabel: fmt(expense.amount_cents),
  }))

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
            {property.ownership_pct < 100 ? (
              <Badge variant="neutral">
                {t('detail.yourShare', { pct: property.ownership_pct })}
              </Badge>
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
          initial={{
            id: property.id,
            name: property.name,
            type: property.type,
            address: property.address,
            city: property.city,
            ownershipPct: property.ownership_pct,
            isRented: property.is_rented,
            rentalStartDate: property.rental_start_date,
            rentalEndDate: property.rental_end_date,
            notes: property.notes,
          }}
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
          footnote={
            property.ownership_pct < 100
              ? t('detail.equityShareNote', { pct: property.ownership_pct })
              : undefined
          }
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
            <ValuationsTable
              rows={valuationRows}
              labels={{
                date: t('tables.date'),
                value: t('tables.value'),
                source: t('tables.source'),
              }}
              deleteAction={deleteValuation}
            />
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
            <LoansTable
              rows={loanRows}
              labels={{
                lender: t('tables.lender'),
                type: t('tables.type'),
                outstanding: t('tables.outstanding'),
                rate: t('tables.rate'),
                payment: t('tables.payment'),
              }}
            />
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
            <IncomeTable
              rows={incomeRows}
              labels={{
                period: t('tables.period'),
                tenant: t('tables.tenant'),
                amount: t('tables.amount'),
              }}
            />
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
            <ExpensesTable
              rows={expenseRows}
              labels={{
                date: t('tables.date'),
                category: t('tables.category'),
                description: t('tables.description'),
                amount: t('tables.amount'),
              }}
              deleteAction={deleteExpense}
            />
          )}
        </GlassCard>
      </section>
    </div>
  )
}
