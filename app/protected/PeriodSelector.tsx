'use client'
import { PERIODS } from '@finova/domain/dashboard'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'

/**
 * URL-driven dashboard period control (P4-04). Mirrors `TransactionFilters`:
 * the selection lives in `?period=`, so the view is shareable + server-rendered.
 */
export function PeriodSelector({ value }: { value: string }) {
  const t = useTranslations('dashboard.period')
  const router = useRouter()
  const [, startTransition] = useTransition()

  const options = PERIODS.map((p) => ({ value: p, label: t(p) }))

  const onChange = (next: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('period', next)
    startTransition(() => {
      router.push(`${url.pathname}?${url.searchParams.toString()}`)
    })
  }

  return (
    <SegmentedControl
      aria-label={t('label')}
      options={options}
      value={value}
      onValueChange={onChange}
    />
  )
}
