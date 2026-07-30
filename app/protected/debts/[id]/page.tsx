import {
  amortizationSchedule,
  nextPaymentDate,
  payoffDate,
} from '@finova/domain/debts/metrics'
import { format, money } from '@finova/domain/money'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { Badge } from '@/components/ui/Badge'
import { GlassCard } from '@/components/ui/GlassCard'
import { requireUser } from '@/lib/auth/require-user'
import { getDateFormatter } from '@/lib/i18n/date-formatter'
import { deleteDebt } from '../actions'
import { DeleteRowButton } from '../DeleteRowButton'
import { getDebtDetail } from '../data'
import { EditDebtButton } from '../EditDebtForm'

const STATUS_VARIANT: Record<string, 'pos' | 'neutral' | 'neg'> = {
  active: 'pos',
  paid_off: 'neutral',
  defaulted: 'neg',
}

export default async function DebtDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireUser()
  const { id } = await params
  const debt = await getDebtDetail(id)
  if (!debt) {
    notFound()
  }
  const [t, locale] = await Promise.all([getTranslations('debts'), getLocale()])
  const todayIso = new Date().toISOString().slice(0, 10)
  const ccy = debt.currency
  const fmt = (cents: number) => format(money(cents, ccy), locale)
  const dateFmt = getDateFormatter(locale, { dateStyle: 'medium' })
  const fmtDate = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`))

  const amortizable = {
    interestRatePct: debt.interest_rate_pct,
    paymentCents: debt.payment_cents,
    principalCents: debt.principal_cents,
    startDate: debt.start_date,
    termMonths: debt.term_months,
  }
  const schedule = amortizationSchedule(amortizable)
  const nextPayment = nextPaymentDate(amortizable, todayIso)
  const payoff = payoffDate(amortizable)

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <Link
        href="/protected/debts"
        className="flex items-center gap-1.5 text-ink-soft text-sm hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('detail.back')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-2xl">{debt.lender}</h1>
            <Badge variant="neutral">{t(`types.${debt.type}`)}</Badge>
            <Badge variant={STATUS_VARIANT[debt.status] ?? 'neutral'}>
              {t(`statuses.${debt.status}`)}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <EditDebtButton debt={debt} />
          <DeleteRowButton action={deleteDebt} id={debt.id} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t('detail.outstanding')}
          value={debt.outstanding_cents}
          currency={ccy}
          locale={locale}
        />
        <KpiCard
          label={t('detail.payment')}
          value={debt.payment_cents}
          currency={ccy}
          locale={locale}
        />
        <KpiCard
          label={t('detail.interestRate')}
          value={debt.interest_rate_pct}
          suffix="%"
          locale={locale}
        />
        <KpiCard
          label={t('detail.nextPaymentDate')}
          value={0}
          empty
          emptyDisplay={nextPayment ? fmtDate(nextPayment) : '—'}
          locale={locale}
        />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-lg">{t('detail.scheduleTitle')}</h2>
          <span className="text-ink-soft text-sm">
            {payoff
              ? `${t('detail.payoffDate')}: ${fmtDate(payoff)}`
              : t('detail.payoffDate')}
          </span>
        </div>
        <p className="text-ink-soft text-xs">{t('detail.scheduleNote')}</p>
        <GlassCard className="overflow-x-auto">
          {schedule.length === 0 ? (
            <p className="text-ink-soft text-sm">{t('detail.empty')}</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-glass">
                  <tr className="text-left text-ink-soft">
                    <th className="py-2 pr-4 font-medium">
                      {t('tables.month')}
                    </th>
                    <th className="py-2 pr-4 font-medium">
                      {t('tables.date')}
                    </th>
                    <th className="py-2 pr-4 text-right font-medium">
                      {t('tables.principal')}
                    </th>
                    <th className="py-2 pr-4 text-right font-medium">
                      {t('tables.interest')}
                    </th>
                    <th className="py-2 text-right font-medium">
                      {t('tables.balance')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((row) => (
                    <tr key={row.month} className="border-glass-line border-t">
                      <td className="py-2 pr-4 text-ink">{row.month}</td>
                      <td className="py-2 pr-4 text-ink-soft">
                        {fmtDate(row.paymentDate)}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {fmt(row.principalCents)}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {fmt(row.interestCents)}
                      </td>
                      <td className="py-2 text-right">
                        {fmt(row.balanceCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </section>
    </div>
  )
}
