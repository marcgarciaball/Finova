'use client'

import { Download, FileJson, FileSpreadsheet } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { GlassCard } from '@/components/ui/GlassCard'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { categoryLabel } from '@/lib/domain/categories/label'
import {
  EXPORT_PRESETS,
  type ExportPreset,
  presetRange,
} from '@/lib/domain/export/presets'
import { UNCATEGORIZED } from '@/lib/domain/transactions/filters'
import type { AccountRow } from '@/lib/validation/account'
import type { CategoryRow } from '@/lib/validation/category'

const SELECT_CLASS =
  'h-11 w-full rounded-2xl border border-glass-line bg-glass px-3 text-ink text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

const CARDS = [
  {
    key: 'csv',
    href: '/protected/export/transactions.csv',
    Icon: FileSpreadsheet,
  },
  { key: 'json', href: '/protected/export/data.json', Icon: FileJson },
] as const

/**
 * Shared export filter bar + the two download cards (export filters spec,
 * 2026-07-03). Filter state is transient client state — the download URLs are
 * where it matters, so both anchors carry the same query params the
 * transactions page uses and the route handlers already parse.
 */
export function ExportFilters({
  accounts,
  categories,
}: {
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

  const sp = new URLSearchParams()
  if (from) sp.set('from', from)
  if (to) sp.set('to', to)
  if (account) sp.set('account', account)
  if (category) sp.set('category', category)
  const qs = sp.toString()
  const withFilters = (href: string) => (qs ? `${href}?${qs}` : href)

  return (
    <div className="flex flex-col gap-4">
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

        {qs ? (
          <p className="text-ink-soft text-xs">{t('filters.filteredNote')}</p>
        ) : null}
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CARDS.map(({ key, href, Icon }) => (
          <GlassCard key={key} className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="flex flex-col">
                <span className="font-medium text-ink">
                  {t(`${key}.title`)}
                </span>
                <span className="text-ink-soft text-xs">
                  {t(`${key}.description`)}
                </span>
              </div>
            </div>
            <Button asChild variant="outline" className="w-fit">
              {/* Plain anchor + download: lets the browser stream the file. */}
              <a href={withFilters(href)} download>
                <Download aria-hidden="true" />
                {t(`${key}.download`)}
              </a>
            </Button>
          </GlassCard>
        ))}
      </div>
    </div>
  )
}
