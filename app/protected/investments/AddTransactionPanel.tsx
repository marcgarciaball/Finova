'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { GlassCard } from '@/components/ui/GlassCard'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { ASSET_TYPES, type AssetType } from '@/lib/domain/investments/types'
import type { AssetOption, ResolvedAsset } from '@/lib/investments/asset-option'
import type { ActionResult, ResolveResult, SearchResult } from './actions'
import { InvestmentTransactionForm } from './InvestmentTransactionForm'

const SELECT_CLASS =
  'h-11 rounded-2xl border border-glass-line bg-glass px-4 py-2 text-ink text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

/**
 * Two-step add flow (Inversiones A4): search & pick an asset (local table
 * first, provider fallback), then record the buy/sell. Actions are injected
 * props so the panel stays jsdom-testable.
 */
export function AddTransactionPanel({
  addAction,
  resolveAction,
  searchAction,
  todayIso,
}: {
  addAction: (
    prev: ActionResult | undefined,
    formData: FormData
  ) => Promise<ActionResult>
  resolveAction: (option: AssetOption) => Promise<ResolveResult>
  searchAction: (query: string, assetType: AssetType) => Promise<SearchResult>
  todayIso: string
}) {
  const t = useTranslations('investments')
  const [query, setQuery] = useState('')
  const [assetType, setAssetType] = useState<AssetType>('stock')
  const [results, setResults] = useState<AssetOption[] | null>(null)
  const [asset, setAsset] = useState<ResolvedAsset | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searching, startSearch] = useTransition()
  const [resolving, startResolve] = useTransition()

  function onSearch() {
    setError(null)
    startSearch(async () => {
      const res = await searchAction(query, assetType)
      if (res.ok) {
        setResults(res.results)
      } else {
        setResults(null)
        setError(t(`errors.${res.error}`))
      }
    })
  }

  function onPick(option: AssetOption) {
    setError(null)
    startResolve(async () => {
      const res = await resolveAction(option)
      if (res.ok) {
        setAsset(res.asset)
        setResults(null)
      } else {
        setError(t(`errors.${res.error}`))
      }
    })
  }

  if (asset) {
    return (
      <GlassCard className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-ink text-sm">
            <span className="font-medium">{asset.ticker}</span>
            <span className="text-ink-soft"> · {asset.name}</span>
          </p>
          <Button type="button" variant="ghost" onClick={() => setAsset(null)}>
            {t('search.change')}
          </Button>
        </div>
        <InvestmentTransactionForm
          action={addAction}
          asset={asset}
          todayIso={todayIso}
        />
      </GlassCard>
    )
  }

  return (
    <GlassCard className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-52 flex-1 flex-col gap-1.5">
          <Label htmlFor="asset-query">{t('search.label')}</Label>
          <Input
            id="asset-query"
            value={query}
            placeholder={t('search.placeholder')}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onSearch()
              }
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="asset-type">{t('search.typeLabel')}</Label>
          <select
            id="asset-type"
            value={assetType}
            onChange={(e) => setAssetType(e.target.value as AssetType)}
            className={SELECT_CLASS}
          >
            {ASSET_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`search.types.${type}`)}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          onClick={onSearch}
          disabled={searching || query.trim().length === 0}
        >
          {searching ? t('search.searching') : t('search.button')}
        </Button>
      </div>

      {error ? <p className="text-neg text-sm">{error}</p> : null}
      {resolving ? (
        <p className="text-ink-soft text-sm">{t('search.resolving')}</p>
      ) : null}

      {results !== null && !resolving ? (
        results.length === 0 ? (
          <p className="text-ink-soft text-sm">{t('search.noResults')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {results.map((r) => (
              <li key={`${r.assetType}-${r.ticker}-${r.coingeckoId ?? ''}`}>
                <button
                  type="button"
                  onClick={() => onPick(r)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-glass"
                >
                  <span>
                    <span className="font-medium text-ink">{r.ticker}</span>
                    <span className="text-ink-soft"> · {r.name}</span>
                  </span>
                  <span className="text-ink-soft text-xs">
                    {t(`search.types.${r.assetType}`)}
                    {r.exchange ? ` · ${r.exchange}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </GlassCard>
  )
}
