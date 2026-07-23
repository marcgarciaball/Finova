'use client'

import { categoryLabel } from '@finova/domain/categories/label'
import {
  EXPORT_PRESETS,
  type ExportPreset,
  presetRange,
} from '@finova/domain/export/presets'
import { UNCATEGORIZED } from '@finova/domain/transactions/filters'
import { Download, FileJson, FileSpreadsheet } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { GlassCard } from '@/components/ui/GlassCard'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import type { AccountRow } from '@/lib/validation/account'
import type { CategoryRow } from '@/lib/validation/category'
import { type ExportView, viewUsesFilters } from './export-view'

const SELECT_CLASS =
  'h-11 w-full rounded-2xl border border-glass-line bg-glass px-3 text-ink text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

type Format = 'csv' | 'json'

interface CardDef {
  extra: Record<string, string>
  /** Whether the transaction filter params attach to this download. */
  filtered: boolean
  format: Format
  key: string
  path: string
}

/** The download cards shown for each view (Spec A). */
const CARDS_BY_VIEW: Record<ExportView, CardDef[]> = {
  everything: [
    {
      key: 'everythingJson',
      path: '/protected/export/backup.json',
      extra: {},
      format: 'json',
      filtered: true,
    },
  ],
  transactions: [
    {
      key: 'transactionsCsv',
      path: '/protected/export/transactions.csv',
      extra: {},
      format: 'csv',
      filtered: true,
    },
    {
      key: 'transactionsJson',
      path: '/protected/export/backup.json',
      extra: { domains: 'transactions' },
      format: 'json',
      filtered: true,
    },
  ],
  investments: [
    {
      key: 'investmentsCsv',
      path: '/protected/export/investments.csv',
      extra: {},
      format: 'csv',
      filtered: false,
    },
    {
      key: 'investmentsJson',
      path: '/protected/export/backup.json',
      extra: { domains: 'investments' },
      format: 'json',
      filtered: false,
    },
  ],
  realEstate: [
    {
      key: 'realEstateCsv',
      path: '/protected/export/real-estate.csv',
      extra: {},
      format: 'csv',
      filtered: false,
    },
    {
      key: 'realEstateJson',
      path: '/protected/export/backup.json',
      extra: { domains: 'realEstate' },
      format: 'json',
      filtered: false,
    },
  ],
}

const ICONS: Record<Format, typeof FileJson> = {
  csv: FileSpreadsheet,
  json: FileJson,
}

/**
 * The Export tab body (Spec A): the shared transaction filter bar (shown only
 * for views that export transactions) plus the download cards for the selected
 * view. Filter state is transient client state — it only matters in the
 * download URLs, so the anchors carry the query params the route handlers
 * already parse.
 */
export function ExportFilters({
  view,
  accounts,
  categories,
}: {
  view: ExportView
  accounts: AccountRow[]
  categories: CategoryRow[]
}) {
  const t = useTranslations('export')
  const tCat = useTranslations('categories.defaults')
  const [preset, setPreset] = useState<ExportPreset | null>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [account, setAccount] = useState('')
  const [category, setCategory] = useState('')

  const showFilters = viewUsesFilters(view)

  const applyPreset = (p: ExportPreset) => {
    setPreset(p)
    const range = presetRange(p, new Date())
    setFrom(range.from ?? '')
    setTo(range.to ?? '')
  }

  // Editing a date by hand means "custom": no pill stays highlighted.
  const setCustomDate = (setter: (v: string) => void) => (value: string) => {
    setPreset(null)
    setter(value)
  }

  const filterParams: Record<string, string> = {}
  if (from) filterParams.from = from
  if (to) filterParams.to = to
  if (account) filterParams.account = account
  if (category) filterParams.category = category
  const hasFilterParams = Object.keys(filterParams).length > 0

  const href = (card: CardDef) => {
    const sp = new URLSearchParams(card.extra)
    if (card.filtered) {
      for (const [k, v] of Object.entries(filterParams)) sp.set(k, v)
    }
    const qs = sp.toString()
    return qs ? `${card.path}?${qs}` : card.path
  }

  const cards = CARDS_BY_VIEW[view]

  return (
    <div className="flex flex-col gap-4">
      {showFilters ? (
        <fieldset className="flex flex-col gap-3 rounded-2xl border border-glass-line bg-glass p-4 shadow-soft">
          <legend className="sr-only">{t('filters.legend')}</legend>

          <div className="flex flex-wrap gap-2">
            {EXPORT_PRESETS.map((p) => (
              <Button
                key={p}
                type="button"
                size="sm"
                variant={preset === p ? 'default' : 'outline'}
                aria-pressed={preset === p}
                onClick={() => applyPreset(p)}
              >
                {t(`filters.presets.${p}`)}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="export-from">{t('filters.from')}</Label>
              <Input
                id="export-from"
                type="date"
                value={from}
                onChange={(e) => setCustomDate(setFrom)(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="export-to">{t('filters.to')}</Label>
              <Input
                id="export-to"
                type="date"
                value={to}
                onChange={(e) => setCustomDate(setTo)(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="export-account">{t('filters.account')}</Label>
              <select
                id="export-account"
                className={SELECT_CLASS}
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                <option value="">{t('filters.allAccounts')}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="export-category">{t('filters.category')}</Label>
              <select
                id="export-category"
                className={SELECT_CLASS}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">{t('filters.allCategories')}</option>
                <option value={UNCATEGORIZED}>
                  {t('filters.uncategorized')}
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {categoryLabel(c, tCat)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {hasFilterParams ? (
            <p className="text-ink-soft text-xs">{t('filters.filteredNote')}</p>
          ) : null}
        </fieldset>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((card) => {
          const Icon = ICONS[card.format]
          return (
            <GlassCard key={card.key} className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="flex flex-col">
                  <span className="font-medium text-ink">
                    {t(`cards.${card.key}.title`)}
                  </span>
                  <span className="text-ink-soft text-xs">
                    {t(`cards.${card.key}.description`)}
                  </span>
                </div>
              </div>
              <Button asChild variant="outline" className="w-fit">
                {/* Plain anchor + download: lets the browser stream the file. */}
                <a href={href(card)} download>
                  <Download aria-hidden="true" />
                  {t(`download.${card.format}`)}
                </a>
              </Button>
            </GlassCard>
          )
        })}
      </div>
    </div>
  )
}
