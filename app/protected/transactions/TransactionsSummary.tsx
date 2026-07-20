import { format, money } from '@finova/domain/money'
import {
  summarizeByCurrency,
  type TxLike,
} from '@finova/domain/transactions/totals'
import { getLocale, getTranslations } from 'next-intl/server'
import { Card, CardContent } from '@/components/ui/Card'

/**
 * Income / expense / net for the current (filtered) list, grouped per currency.
 * Transfers are excluded (P1-06). Multi-currency totals stay in their native
 * unit — no FX conversion here (P1-07 keeps rates out of the domain), so a user
 * holding EUR + USD sees one card per currency.
 */
export async function TransactionsSummary({
  transactions,
}: {
  transactions: TxLike[]
}) {
  const t = await getTranslations('transactions')
  const locale = await getLocale()
  const byCurrency = summarizeByCurrency(transactions)
  const currencies = Object.keys(byCurrency).sort()

  if (currencies.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {currencies.map((currency) => {
        const totals = byCurrency[currency]
        if (!totals) {
          return null
        }
        return (
          <Card key={currency}>
            <CardContent className="flex flex-col gap-2 pt-6">
              <span className="font-medium text-ink-soft text-xs uppercase tracking-wide">
                {t('summary.title')} · {currency}
              </span>
              <dl className="flex flex-col gap-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-soft">{t('summary.income')}</dt>
                  <dd className="font-semibold text-pos tabular-nums">
                    {format(money(totals.income, currency), locale)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-soft">{t('summary.expense')}</dt>
                  <dd className="font-semibold text-neg tabular-nums">
                    {format(money(-totals.expense, currency), locale)}
                  </dd>
                </div>
                <div className="flex justify-between border-glass-line border-t pt-1">
                  <dt className="text-ink">{t('summary.net')}</dt>
                  <dd
                    className={`font-semibold tabular-nums ${
                      totals.net < 0 ? 'text-neg' : 'text-pos'
                    }`}
                  >
                    {format(money(totals.net, currency), locale)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
