'use client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { PERIODS } from '@/lib/domain/dashboard'

/**
 * URL-driven dashboard period control (P4-04). Mirrors `TransactionFilters`:
 * the selection lives in `?period=`, so the view is shareable + server-rendered.
 */
export function PeriodSelector({ value }: { value: string }) {
  const t = useTranslations('dashboard.period')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const options = PERIODS.map((p) => ({ value: p, label: t(p) }))

  const onChange = (next: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('period', next)
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
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
